import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Focused tests for the SaaS signup path (M3/E3): signup creates a Tenant +
 * OWNER and starts the 30-day trial. UniCore is always multi-tenant SaaS, so
 * signup is always available.
 */
describe('AuthService.signup', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function build() {
    const createdTenant = {
      id: 'tenant-1',
      slug: 'acme',
      name: 'Acme',
      plan: 'GROWTH',
      subscriptionStatus: 'TRIALING',
    };
    const prisma = {
      user: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }: any) => ({
          id: 'user-1',
          email: data.email,
          name: data.name,
          role: data.role,
          tenantId: data.tenantId,
        })),
      },
      tenant: {
        findUnique: jest.fn(async () => null), // slug not taken
        create: jest.fn(async ({ data }: any) => ({ ...createdTenant, ...data })),
      },
      // OWNER Membership is now inserted separately (in the new tenant's RLS
      // context), no longer nested under user.create.
      membership: { create: jest.fn(async () => ({ id: 'm1' })) },
      session: { create: jest.fn(async () => ({})) },
      verificationToken: { create: jest.fn(async () => ({})) },
    };
    const jwtService = { sign: jest.fn(() => 'signed.jwt.token') };
    const blacklist = {};
    const email = { send: jest.fn(async () => true) };
    const service = new AuthService(
      prisma as any,
      jwtService as any,
      blacklist as any,
      email as any,
    );
    service.onModuleDestroy(); // stop the cleanup interval immediately
    return { service, prisma, jwtService, email };
  }

  const dto = {
    email: 'owner@acme.com',
    name: 'Owner',
    password: 'Password1',
    businessName: 'Acme',
  };

  it('creates a TRIALING Growth tenant + OWNER and returns tokens', async () => {
    const { service, prisma } = build();
    const result = await service.signup(dto as any);

    expect(prisma.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Acme',
          status: 'ACTIVE',
          plan: 'GROWTH',
          subscriptionStatus: 'TRIALING',
          trialEndsAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'OWNER', tenantId: 'tenant-1' }),
      }),
    );
    // The OWNER Membership is inserted SEPARATELY in the new tenant's context
    // (RLS WITH CHECK), with tenantId == the created tenant — not nested under
    // user.create (which would run under the demo/no-context tenant and 42501).
    expect((prisma as any).membership.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', tenantId: 'tenant-1', role: 'OWNER' },
    });
    const userCreateData = prisma.user.create.mock.calls[0][0].data;
    expect(userCreateData.memberships).toBeUndefined();
    // trialEndsAt is ~30 days out
    const data = prisma.tenant.create.mock.calls[0][0].data;
    const days = Math.round((data.trialEndsAt.getTime() - Date.now()) / 86_400_000);
    expect(days).toBe(30);
    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user.email).toBe('owner@acme.com');
  });

  it('rejects a duplicate email', async () => {
    const { service, prisma } = build();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing' } as any);
    await expect(service.signup(dto as any)).rejects.toBeInstanceOf(ConflictException);
  });
});
