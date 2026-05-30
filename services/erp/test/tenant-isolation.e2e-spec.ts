/**
 * Cross-tenant data-leak test (SaaS phase 4.5 — the mandatory security gate,
 * SAAS-ARCHITECTURE.md §8).
 *
 * Exercises the REAL PrismaService tenant-RLS extension against a live
 * Postgres that has had `prisma db push` + `scripts/apply-rls.sql` applied.
 * Seeds two tenants (A, B) and asserts:
 *   - within tenant A's context, queries see ONLY A's rows (Contact, Order,
 *     Invoice, and the v_ar_aging view);
 *   - reading B's rows from A's context returns zero;
 *   - RLS fails CLOSED when app.tenant_id is the wrong/another tenant;
 *   - WITH CHECK rejects writing a row for a foreign tenant.
 *
 * Gated on RLS_DATABASE_URL. When unset (e.g. a Postgres-less unit run) the
 * suite is skipped with a clear message — live RLS execution is then deferred
 * to a Postgres-backed CI job. DO NOT treat a skipped run as a pass.
 */
import { PrismaService } from '../src/prisma/prisma.service';
import { runWithTenant } from '../src/common/tenancy/tenant-context';

const RLS_URL = process.env.RLS_DATABASE_URL;
const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

const maybe = RLS_URL ? describe : describe.skip;

maybe('Tenant isolation (RLS leak test)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = RLS_URL;
    prisma = new PrismaService();
    await prisma.onModuleInit();

    // Clean slate for the two test tenants (run in each tenant's context so
    // RLS permits the delete).
    for (const t of [TENANT_A, TENANT_B]) {
      await runWithTenant(t, async () => {
        await prisma.invoice.deleteMany({});
        await prisma.order.deleteMany({});
        await prisma.contact.deleteMany({});
      });
    }

    // Seed A.
    await runWithTenant(TENANT_A, async () => {
      await prisma.contact.create({ data: { tenantId: TENANT_A, name: 'Alice A' } });
      await prisma.order.create({
        data: { tenantId: TENANT_A, orderNumber: 'ORD-A-1', createdById: TENANT_A },
      });
      await prisma.invoice.create({
        data: {
          tenantId: TENANT_A,
          invoiceNumber: 'INV-A-1',
          dueDate: new Date(),
          status: 'SENT',
          total: 100,
          amountDue: 100,
          createdById: TENANT_A,
        },
      });
    });

    // Seed B.
    await runWithTenant(TENANT_B, async () => {
      await prisma.contact.create({ data: { tenantId: TENANT_B, name: 'Bob B' } });
      await prisma.order.create({
        data: { tenantId: TENANT_B, orderNumber: 'ORD-B-1', createdById: TENANT_B },
      });
      await prisma.invoice.create({
        data: {
          tenantId: TENANT_B,
          invoiceNumber: 'INV-B-1',
          dueDate: new Date(),
          status: 'SENT',
          total: 200,
          amountDue: 200,
          createdById: TENANT_B,
        },
      });
    });
  });

  afterAll(async () => {
    if (prisma) await prisma.onModuleDestroy();
  });

  it('tenant A sees ONLY its own Contact / Order / Invoice rows', async () => {
    await runWithTenant(TENANT_A, async () => {
      const contacts = await prisma.contact.findMany();
      const orders = await prisma.order.findMany();
      const invoices = await prisma.invoice.findMany();
      expect(contacts).toHaveLength(1);
      expect(contacts[0].name).toBe('Alice A');
      expect(orders.map((o) => o.orderNumber)).toEqual(['ORD-A-1']);
      expect(invoices.map((i) => i.invoiceNumber)).toEqual(['INV-A-1']);
    });
  });

  it('the v_ar_aging view is tenant-filtered for A', async () => {
    await runWithTenant(TENANT_A, async () => {
      const aging = await prisma.arAging.findMany();
      expect(aging.map((r) => r.invoiceNumber)).toEqual(['INV-A-1']);
      expect(aging.every((r) => r.tenantId === TENANT_A)).toBe(true);
    });
  });

  it("tenant A cannot read tenant B's rows even with an explicit B filter", async () => {
    await runWithTenant(TENANT_A, async () => {
      const leaked = await prisma.contact.findMany({ where: { tenantId: TENANT_B } });
      expect(leaked).toHaveLength(0);
      const leakedInv = await prisma.invoice.findMany({ where: { tenantId: TENANT_B } });
      expect(leakedInv).toHaveLength(0);
    });
  });

  it('tenant B sees ONLY its own rows (symmetry)', async () => {
    await runWithTenant(TENANT_B, async () => {
      const contacts = await prisma.contact.findMany();
      expect(contacts).toHaveLength(1);
      expect(contacts[0].name).toBe('Bob B');
    });
  });

  it('RLS fails CLOSED under an unknown tenant context (zero rows)', async () => {
    await runWithTenant('33333333-3333-3333-3333-333333333333', async () => {
      const contacts = await prisma.contact.findMany();
      expect(contacts).toHaveLength(0);
    });
  });

  it('WITH CHECK rejects inserting a row for a foreign tenant', async () => {
    await expect(
      runWithTenant(TENANT_A, async () =>
        prisma.contact.create({ data: { tenantId: TENANT_B, name: 'Cross' } }),
      ),
    ).rejects.toThrow();
  });
});
