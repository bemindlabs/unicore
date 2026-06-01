/**
 * Cross-tenant data-leak test for the api-gateway DB (SaaS phase 4.5).
 *
 * Mirrors the ERP leak test against the gateway's own tenant-scoped tables
 * (tasks, conversations, audit_logs). Exercises the REAL gateway PrismaService
 * RLS extension. Gated on RLS_DATABASE_URL; skipped (NOT passed) when unset.
 */
import { PrismaService } from '../src/prisma/prisma.service';
import { runWithTenant } from '../src/common/tenancy/tenant-store';

const RLS_URL = process.env.RLS_DATABASE_URL;
const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

const maybe = RLS_URL ? describe : describe.skip;

maybe('Gateway tenant isolation (RLS leak test)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = RLS_URL;
    prisma = new PrismaService();
    await prisma.onModuleInit();

    for (const t of [TENANT_A, TENANT_B]) {
      await runWithTenant(t, async () => {
        await prisma.task.deleteMany({});
        await prisma.auditLog.deleteMany({});
      });
    }

    await runWithTenant(TENANT_A, async () => {
      await prisma.task.create({ data: { tenantId: TENANT_A, title: 'Task A', creatorId: 'u-a' } });
      await prisma.auditLog.create({
        data: { tenantId: TENANT_A, action: 'create', resource: 'tasks' },
      });
    });
    await runWithTenant(TENANT_B, async () => {
      await prisma.task.create({ data: { tenantId: TENANT_B, title: 'Task B', creatorId: 'u-b' } });
    });
  });

  afterAll(async () => {
    if (prisma) await prisma.onModuleDestroy();
  });

  it('tenant A sees only its own tasks', async () => {
    await runWithTenant(TENANT_A, async () => {
      const tasks = await prisma.task.findMany();
      expect(tasks.map((t) => t.title)).toEqual(['Task A']);
    });
  });

  it('tenant A cannot read tenant B tasks even with explicit filter', async () => {
    await runWithTenant(TENANT_A, async () => {
      const leaked = await prisma.task.findMany({ where: { tenantId: TENANT_B } });
      expect(leaked).toHaveLength(0);
    });
  });

  it('RLS fails CLOSED under an unknown tenant', async () => {
    await runWithTenant('33333333-3333-3333-3333-333333333333', async () => {
      expect(await prisma.task.findMany()).toHaveLength(0);
      expect(await prisma.auditLog.findMany()).toHaveLength(0);
    });
  });

  it('WITH CHECK rejects writing a task for a foreign tenant', async () => {
    await expect(
      runWithTenant(TENANT_A, async () =>
        prisma.task.create({ data: { tenantId: TENANT_B, title: 'X', creatorId: 'u' } }),
      ),
    ).rejects.toThrow();
  });
});
