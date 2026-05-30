import { TrialSchedulerService } from './trial-scheduler.service';
import { TenantSubscriptionService } from './tenant-subscription.service';

describe('TrialSchedulerService daily sweep', () => {
  const original = process.env.DEPLOYMENT_MODE;
  afterEach(() => {
    process.env.DEPLOYMENT_MODE = original;
    jest.clearAllMocks();
  });

  function build(tenants: any[]) {
    const updated: any[] = [];
    const prisma = {
      tenant: {
        findMany: jest.fn(async ({ where }: any) => {
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
    };
    const email = { send: jest.fn(async () => true) };
    const subscriptions = new TenantSubscriptionService(prisma as any);
    const scheduler = new TrialSchedulerService(
      prisma as any,
      email as any,
      subscriptions as any,
    );
    return { scheduler, prisma, email, updated };
  }

  it('is a no-op in self-host mode', async () => {
    process.env.DEPLOYMENT_MODE = 'self-host';
    const { scheduler, email } = build([
      { id: 't1', slug: 's', name: 'N', subscriptionStatus: 'TRIALING', status: 'ACTIVE', trialEndsAt: new Date('2020-01-01') },
    ]);
    const res = await scheduler.runDailySweep(new Date('2026-01-10T00:00:00Z'));
    expect(res).toEqual({ reminded: 0, suspended: 0 });
    expect(email.send).not.toHaveBeenCalled();
  });

  it('emails reminders for milestone tenants and suspends expired ones', async () => {
    process.env.DEPLOYMENT_MODE = 'saas';
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

  it('is idempotent — a second run does not re-suspend already-suspended tenants', async () => {
    process.env.DEPLOYMENT_MODE = 'saas';
    const now = new Date('2026-01-10T00:00:00Z');
    const { scheduler, prisma } = build([
      { id: 'exp', slug: 'exp', name: 'Exp', subscriptionStatus: 'TRIALING', status: 'ACTIVE', trialEndsAt: new Date('2026-01-05T00:00:00Z') },
    ]);
    await scheduler.runDailySweep(now); // suspends 'exp'
    prisma.tenant.update.mockClear();
    const res2 = await scheduler.runDailySweep(now); // 'exp' now SUSPENDED, excluded
    expect(res2.suspended).toBe(0);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});
