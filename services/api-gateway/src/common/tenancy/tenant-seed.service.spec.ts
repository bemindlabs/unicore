import { Test, TestingModule } from '@nestjs/testing';
import { TenantSeedService } from './tenant-seed.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DEMO_TENANT_ID } from './tenancy.config';

const mockPrisma = {
  tenant: { upsert: jest.fn() },
  user: { updateMany: jest.fn() },
};

describe('TenantSeedService', () => {
  let service: TenantSeedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantSeedService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<TenantSeedService>(TenantSeedService);
    jest.clearAllMocks();
  });

  it('upserts the demo tenant and backfills users with no tenant', async () => {
    mockPrisma.tenant.upsert.mockResolvedValue({ id: DEMO_TENANT_ID });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 3 });

    await service.ensureDemoTenant();

    expect(mockPrisma.tenant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DEMO_TENANT_ID },
        create: expect.objectContaining({ id: DEMO_TENANT_ID, slug: 'demo' }),
      }),
    );
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { tenantId: null },
      data: { tenantId: DEMO_TENANT_ID },
    });
  });

  it('does not throw when the table is missing (onModuleInit)', async () => {
    mockPrisma.tenant.upsert.mockRejectedValue(new Error('relation "tenants" does not exist'));
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });
});
