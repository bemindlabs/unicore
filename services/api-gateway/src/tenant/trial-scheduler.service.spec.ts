import { TrialSchedulerService } from './trial-scheduler.service';
import { TenantSubscriptionService } from './tenant-subscription.service';

describe('TrialSchedulerService daily sweep', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function build(tenants: any[]) {
    const updated: any[] = [];
    const deletes: Array<{ sql: string; param?: string }> = [];
    const prisma = {
      tenant: {
        findMany: jest.fn(async ({ where }: any) => {
          // Retention-purge query: SUSPENDED + updatedAt < cutoff + not demo.
          if (where.status === 'SUSPENDED') {
            return tenants.filter(
              (t) =>
                t.status === 'SUSPENDED' &&
                t.updatedAt &&
                t.updatedAt < where.updatedAt.lt &&
                t.id !== where.id?.not,
            );
          }
          // Reminder query: TRIALING + not suspended
          if (where.trialEndsAt) {
            return tenants.filter(
              (t) =>
                t.subscriptionStatus === 'TRIALING' &&
                t.status !== 'SUSPENDED' &&
                t.trialEndsAt &&
                t.trialEndsAt < where.trialEndsAt.lt,
            );
          }
          return tenants.filter(
            (t) => t.subscriptionStatus === 'TRIALING' && t.status !== 'SUSPENDED',
          );
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const t = tenants.find((x) => x.id === where.id);
          if (t) Object.assign(t, data);
          updated.push({ id: where.id, data });
          return t;
        }),
      },
      user: {
        findFirst: jest.fn(async ({ where }: any) => ({
          email: `owner-${where.tenantId}@x.com`,
          name: 'Owner',
        })),
      },
      $executeRawUnsafe: jest.fn(async (sql: string, param?: string) => {
        deletes.push({ sql, param });
        return 0;
      }),
      $transaction: jest.fn(async (fn: any) => {
        // Purge path passes a callback; reminder path is not used here.
        if (typeof fn === 'function') {
          const tx = {
            $executeRawUnsafe: jest.fn(async (sql: string, param?: string) => {
              deletes.push({ sql, param });
              return 0;
            }),
          };
          return fn(tx);
        }
        return Promise.all(fn);
      }),
    };
    const email = { send: jest.fn(async () => true) };
    const subscriptions = new TenantSubscriptionService(prisma as any);
    const scheduler = new TrialSchedulerService(
      prisma as any,
      email as any,
      subscriptions as any,
    );
    return { scheduler, prisma, email, updated, deletes };
  }

  it('emails reminders for milestone tenants and suspends expired ones', async () => {
    const now = new Date('2026-01-10T00:00:00Z');
    const { scheduler, email, prisma } = build([
      // T-7 reminder
      { id: 'rem', slug: 'rem', name: 'Rem', subscriptionStatus: 'TRIALING', status: 'ACTIVE', trialEndsAt: new Date('2026-01-17T00:00:00Z') },
      // non-milestone (5 days) → no reminder, not expired
      { id: 'mid', slug: 'mid', name: 'Mid', subscriptionStatus: 'TRIALING', status: 'ACTIVE', trialEndsAt: new Date('2026-01-15T00:00:00Z') },
      // expired → suspend
      { id: 'exp', slug: 'exp', name: 'Exp', subscriptionStatus: 'TRIALING', status: 'ACTIVE', trialEndsAt: new Date('2026-01-05T00:00:00Z') },
    ]);
    const res = await scheduler.runDailySweep(now);
    expect(res.suspended).toBe(1);
    // 'exp' is T-0 (expired) so it also gets a reminder + the expiry email; 'rem' gets T-7.
    expect(res.reminded).toBeGreaterThanOrEqual(2);
    // exp was flipped to SUSPENDED
    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'exp' }, data: { status: 'SUSPENDED' } }),
    );
    expect(email.send).toHaveBeenCalled();
  });

  // GAPS #9: the scheduler must actually fire — a boot sweep runs shortly after
  // onModuleInit so reminders + expiry→SUSPEND happen without waiting up to 24h.
  it('runs a sweep shortly after boot (onModuleInit)', async () => {
    jest.useFakeTimers();
    process.env.TRIAL_SWEEP_BOOT_DELAY_MS = '10000';
    try {
      const { scheduler } = build([]);
      const sweep = jest
        .spyOn(scheduler, 'runDailySweep')
        .mockResolvedValue({ reminded: 0, suspended: 0, purged: 0 });

      scheduler.onModuleInit();
      expect(sweep).not.toHaveBeenCalled(); // not synchronous

      jest.advanceTimersByTime(10000);
      await Promise.resolve(); // flush the queued microtask
      expect(sweep).toHaveBeenCalledTimes(1);

      scheduler.onModuleDestroy();
    } finally {
      jest.useRealTimers();
      delete process.env.TRIAL_SWEEP_BOOT_DELAY_MS;
    }
  });

  it('is idempotent — a second run does not re-suspend already-suspended tenants', async () => {
    const now = new Date('2026-01-10T00:00:00Z');
    const { scheduler, prisma } = build([
      { id: 'exp', slug: 'exp', name: 'Exp', subscriptionStatus: 'TRIALING', status: 'ACTIVE', trialEndsAt: new Date('2026-01-05T00:00:00Z') },
    ]);
    await scheduler.runDailySweep(now); // suspends 'exp'
    prisma.tenant.update.mockClear();
    const res2 = await scheduler.runDailySweep(now); // 'exp' now SUSPENDED, excluded
    expect(res2.suspended).toBe(0);
    // 'exp' was suspended at `now`, so it is NOT yet past the retention window —
    // no purge, no further tenant update.
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  // ---- GAPS #10: retention purge --------------------------------------------
  describe('retention purge', () => {
    const DEMO = '00000000-0000-0000-0000-000000000000';
    const old = new Date('2026-01-01T00:00:00Z'); // > 30d before `now`
    const now = new Date('2026-03-01T00:00:00Z');

    it('purges only tenants SUSPENDED longer than RETENTION_DAYS, skips demo and recent', async () => {
      const { scheduler, prisma, email, deletes } = build([
        // suspended long ago → purge
        { id: '11111111-1111-1111-1111-111111111111', slug: 'old', name: 'Old', subscriptionStatus: 'TRIALING', status: 'SUSPENDED', updatedAt: old },
        // suspended recently → keep
        { id: '22222222-2222-2222-2222-222222222222', slug: 'recent', name: 'Recent', subscriptionStatus: 'TRIALING', status: 'SUSPENDED', updatedAt: now },
        // demo tenant suspended long ago → must NEVER be purged
        { id: DEMO, slug: 'demo', name: 'Demo', subscriptionStatus: 'TRIALING', status: 'SUSPENDED', updatedAt: old },
      ]);

      const res = await scheduler.runDailySweep(now);
      expect(res.purged).toBe(1);
      // final-warning email sent to the purged tenant's owner
      expect(email.send).toHaveBeenCalled();
      // the purged tenant was marked ARCHIVED
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '11111111-1111-1111-1111-111111111111' },
          data: { status: 'ARCHIVED' },
        }),
      );
      // demo tenant id never appears in any delete statement
      expect(deletes.some((d) => d.param === DEMO)).toBe(false);
      // an audit row was written before the delete
      expect(deletes.some((d) => /INSERT INTO audit_logs/i.test(d.sql))).toBe(true);
      // SET LOCAL app.tenant_id was issued for the target tenant
      expect(deletes.some((d) => /SET LOCAL app\.tenant_id/i.test(d.sql))).toBe(true);
    });

    it('is idempotent — an ARCHIVED tenant is not re-purged on the next run', async () => {
      const { scheduler, prisma } = build([
        { id: '11111111-1111-1111-1111-111111111111', slug: 'old', name: 'Old', subscriptionStatus: 'TRIALING', status: 'SUSPENDED', updatedAt: old },
      ]);
      const r1 = await scheduler.purgeExpiredSuspendedTenants(now);
      expect(r1).toBe(1);
      prisma.tenant.update.mockClear();
      const r2 = await scheduler.purgeExpiredSuspendedTenants(now); // now ARCHIVED
      expect(r2).toBe(0);
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });
  });
});
