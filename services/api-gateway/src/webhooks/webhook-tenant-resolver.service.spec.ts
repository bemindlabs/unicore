import { Test, TestingModule } from '@nestjs/testing';
import { WebhookTenantResolver } from './webhook-tenant-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEMO_TENANT_ID } from '../common/tenancy/tenancy.config';

/**
 * GAPS #1 — inbound webhooks resolve the owning tenant by matching the inbound
 * destination/bot identifier against each tenant's stored channel Settings.
 */
describe('WebhookTenantResolver (GAPS #1)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  let resolver: WebhookTenantResolver;
  let tenantFindMany: jest.Mock;
  let settingsFindUnique: jest.Mock;

  beforeEach(async () => {
    tenantFindMany = jest.fn().mockResolvedValue([{ id: TENANT_A }, { id: TENANT_B }]);
    settingsFindUnique = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookTenantResolver,
        {
          provide: PrismaService,
          useValue: {
            tenant: { findMany: tenantFindMany },
            settings: { findUnique: settingsFindUnique },
          },
        },
      ],
    }).compile();
    resolver = module.get(WebhookTenantResolver);
  });

  it('resolves the LINE tenant by webhook destination (bot userId)', async () => {
    settingsFindUnique.mockImplementation(({ where }) => {
      const { tenantId, key } = where.tenantId_key;
      if (tenantId === TENANT_B && key === 'line') {
        return Promise.resolve({ data: { destination: 'Ubotabc' } });
      }
      return Promise.resolve(null);
    });

    const tid = await resolver.resolveLine('Ubotabc');
    expect(tid).toBe(TENANT_B);
  });

  it('resolves the Telegram tenant by bot id parsed from the stored token', async () => {
    settingsFindUnique.mockImplementation(({ where }) => {
      const { tenantId, key } = where.tenantId_key;
      if (tenantId === TENANT_A && key === 'telegram') {
        return Promise.resolve({ data: { botToken: '987654:abcdefSECRET' } });
      }
      return Promise.resolve(null);
    });

    const tid = await resolver.resolveTelegram('987654');
    expect(tid).toBe(TENANT_A);
  });

  it('returns null when no tenant claims the identifier', async () => {
    settingsFindUnique.mockResolvedValue(null);
    expect(await resolver.resolveLine('Uunknown')).toBeNull();
    expect(await resolver.resolveTelegram('000')).toBeNull();
  });

  it('returns null for missing identifiers without scanning', async () => {
    expect(await resolver.resolveLine(undefined)).toBeNull();
    expect(await resolver.resolveTelegram(undefined)).toBeNull();
    expect(tenantFindMany).not.toHaveBeenCalled();
  });

  it('exposes the DEMO tenant as the fallback', () => {
    expect(resolver.fallbackTenantId).toBe(DEMO_TENANT_ID);
  });
});
