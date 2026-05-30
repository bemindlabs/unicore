import { NotFoundException } from '@nestjs/common';
import { TenantSubscriptionService } from './tenant-subscription.service';

function makeService(tenant: any) {
  const prisma = {
    tenant: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id && tenant?.id === where.id) return tenant;
        if (where.stripeSubscriptionId && tenant?.stripeSubscriptionId === where.stripeSubscriptionId)
          return tenant;
        return null;
      }),
      findFirst: jest.fn(async () => tenant ?? null),
      update: jest.fn(async ({ data }: any) => ({ ...tenant, ...data })),
    },
  };
  const service = new TenantSubscriptionService(prisma as any);
  return { service, prisma };
}

describe('TenantSubscriptionService', () => {
  const now = new Date('2026-01-10T00:00:00.000Z');

  describe('getSubscription (trial-status math)', () => {
    it('reports trial days remaining and Growth entitlements while TRIALING', async () => {
      const tenant = {
        id: 't1',
        plan: 'GROWTH',
        status: 'ACTIVE',
        subscriptionStatus: 'TRIALING',
        trialEndsAt: new Date('2026-01-17T00:00:00.000Z'),
      };
      const { service } = makeService(tenant);
      const view = await service.getSubscription('t1', now);
      expect(view.isTrialing).toBe(true);
      expect(view.trialDaysRemaining).toBe(7);
      expect(view.entitlementEdition).toBe('pro'); // full Growth during trial
      expect(view.suspended).toBe(false);
    });

    it('reports suspended + 0 days once SUSPENDED', async () => {
      const tenant = {
        id: 't2',
        plan: 'GROWTH',
        status: 'SUSPENDED',
        subscriptionStatus: 'TRIALING',
        trialEndsAt: new Date('2026-01-05T00:00:00.000Z'),
      };
      const { service } = makeService(tenant);
      const view = await service.getSubscription('t2', now);
      expect(view.suspended).toBe(true);
      expect(view.trialDaysRemaining).toBe(0);
    });

    it('uses plan edition (not trial) once ACTIVE on STARTER', async () => {
      const tenant = {
        id: 't3',
        plan: 'STARTER',
        status: 'ACTIVE',
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: null,
      };
      const { service } = makeService(tenant);
      const view = await service.getSubscription('t3', now);
      expect(view.isTrialing).toBe(false);
      expect(view.entitlementEdition).toBe('community');
    });

    it('throws when tenant missing', async () => {
      const { service } = makeService(null);
      await expect(service.getSubscription('missing', now)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('reminderMilestoneFor (reminder selection by day)', () => {
    const { service } = makeService(null);
    const at = (iso: string) => new Date(iso);

    it('selects T-7/T-3/T-1 on matching days', () => {
      expect(service.reminderMilestoneFor(at('2026-01-17T00:00:00Z'), now)).toBe(7);
      expect(service.reminderMilestoneFor(at('2026-01-13T00:00:00Z'), now)).toBe(3);
      expect(service.reminderMilestoneFor(at('2026-01-11T00:00:00Z'), now)).toBe(1);
    });

    it('selects T-0 on/after the expiry instant', () => {
      expect(service.reminderMilestoneFor(at('2026-01-10T00:00:00Z'), now)).toBe(0);
      expect(service.reminderMilestoneFor(at('2026-01-09T00:00:00Z'), now)).toBe(0);
    });

    it('returns null on non-milestone days and for null', () => {
      expect(service.reminderMilestoneFor(at('2026-01-15T00:00:00Z'), now)).toBeNull();
      expect(service.reminderMilestoneFor(null, now)).toBeNull();
    });
  });

  describe('applySubscriptionUpdate (E4 conversion)', () => {
    it('ACTIVE clears suspend, sets plan + stripe ids', async () => {
      const tenant = {
        id: 't4',
        plan: 'GROWTH',
        status: 'SUSPENDED',
        subscriptionStatus: 'TRIALING',
        trialEndsAt: new Date('2026-01-05T00:00:00Z'),
      };
      const { service, prisma } = makeService(tenant);
      // After update, getSubscription re-reads the merged tenant.
      prisma.tenant.findUnique.mockImplementation(async () => ({
        ...tenant,
        status: 'ACTIVE',
        subscriptionStatus: 'ACTIVE',
        plan: 'GROWTH',
      }));
      const view = await service.applySubscriptionUpdate({
        tenantId: 't4',
        subscriptionStatus: 'ACTIVE',
        plan: 'GROWTH',
        stripeCustomerId: 'cus_x',
        stripeSubscriptionId: 'sub_x',
      });
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'ACTIVE',
            status: 'ACTIVE',
            plan: 'GROWTH',
            stripeCustomerId: 'cus_x',
            stripeSubscriptionId: 'sub_x',
          }),
        }),
      );
      expect(view.suspended).toBe(false);
    });

    it('CANCELED suspends the tenant (read-only)', async () => {
      const tenant = {
        id: 't5',
        plan: 'GROWTH',
        status: 'ACTIVE',
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: null,
      };
      const { service, prisma } = makeService(tenant);
      await service.applySubscriptionUpdate({
        tenantId: 't5',
        subscriptionStatus: 'CANCELED',
      });
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subscriptionStatus: 'CANCELED', status: 'SUSPENDED' }),
        }),
      );
    });
  });
});
