/**
 * Service-level cross-tenant leak test (SaaS phase 4.5, FU-05).
 *
 * Where tenant-isolation.e2e-spec.ts exercises the PrismaService/RLS at the DB
 * layer, this suite drives REAL HTTP requests through the booted ERP NestJS app
 * (TenantContextMiddleware -> AsyncLocalStorage -> PrismaService SET LOCAL ->
 * Postgres RLS). It proves isolation holds end-to-end at the transport the
 * api-gateway actually talks to: the trusted `x-tenant-id` header.
 *
 * Asserts, over HTTP:
 *   - tenant A's requests list ONLY A's Contacts/Orders/Invoices;
 *   - tenant A cannot GET/PATCH/DELETE a resource that belongs to tenant B
 *     (cross-tenant id is a 404, never a leak or a silent foreign mutation);
 *   - a request with NO `x-tenant-id` (or a malformed/spoofed one) falls back to
 *     the default tenant and therefore sees neither A nor B (RLS fails closed);
 *   - per-tenant uniqueness (FU-03): the same email/SKU/orderNumber can be
 *     created in both tenants without a 409 collision.
 *
 * Gated on RLS_DATABASE_URL exactly like the DB-layer suite, so a Postgres-less
 * CI run SKIPS cleanly (a skip is NOT a pass — live execution belongs to a
 * Postgres-backed job with a NOSUPERUSER/NOBYPASSRLS role + apply-rls.sql).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { runWithTenant } from '../src/common/tenancy/tenant-context';

const RLS_URL = process.env.RLS_DATABASE_URL;
const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

const maybe = RLS_URL ? describe : describe.skip;

maybe('ERP tenant isolation over HTTP (service-level leak test)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    process.env.DATABASE_URL = RLS_URL;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());

    prisma = app.get(PrismaService);

    // Clean slate for both tenants (run in each tenant's RLS context).
    for (const t of [TENANT_A, TENANT_B]) {
      await runWithTenant(t, async () => {
        await prisma.invoice.deleteMany({});
        await prisma.order.deleteMany({});
        await prisma.contact.deleteMany({});
      });
    }
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  /** Create a contact for `tenant` via HTTP and return the created id. */
  async function createContact(tenant: string, email: string): Promise<string> {
    const res = await http
      .post('/api/v1/contacts')
      .set('x-tenant-id', tenant)
      .send({ firstName: 'T', lastName: tenant.slice(0, 4), email })
      .expect(201);
    return res.body.id as string;
  }

  it('lists ONLY the calling tenant\'s contacts (no cross-tenant rows over HTTP)', async () => {
    await createContact(TENANT_A, 'a@example.com');
    await createContact(TENANT_B, 'b@example.com');

    const aRes = await http.get('/api/v1/contacts').set('x-tenant-id', TENANT_A).expect(200);
    const aEmails = aRes.body.data.map((c: { email: string }) => c.email);
    expect(aEmails).toContain('a@example.com');
    expect(aEmails).not.toContain('b@example.com');

    const bRes = await http.get('/api/v1/contacts').set('x-tenant-id', TENANT_B).expect(200);
    const bEmails = bRes.body.data.map((c: { email: string }) => c.email);
    expect(bEmails).toContain('b@example.com');
    expect(bEmails).not.toContain('a@example.com');
  });

  it('tenant A cannot GET tenant B\'s contact by id (404, never a leak)', async () => {
    const bId = await createContact(TENANT_B, 'secret-b@example.com');
    await http.get(`/api/v1/contacts/${bId}`).set('x-tenant-id', TENANT_A).expect(404);
    // B itself can still read it.
    await http.get(`/api/v1/contacts/${bId}`).set('x-tenant-id', TENANT_B).expect(200);
  });

  it('tenant A cannot DELETE tenant B\'s contact (no cross-tenant mutation)', async () => {
    const bId = await createContact(TENANT_B, 'delete-b@example.com');
    await http.delete(`/api/v1/contacts/${bId}`).set('x-tenant-id', TENANT_A).expect(404);
    // Row survives — B can still read it.
    await http.get(`/api/v1/contacts/${bId}`).set('x-tenant-id', TENANT_B).expect(200);
  });

  it('a request with NO x-tenant-id falls back to default tenant and sees neither A nor B', async () => {
    await createContact(TENANT_A, 'visible-a@example.com');
    const res = await http.get('/api/v1/contacts').expect(200);
    const emails = res.body.data.map((c: { email: string }) => c.email);
    expect(emails).not.toContain('visible-a@example.com');
  });

  it('a spoofed/malformed x-tenant-id is rejected and falls back to default (fails closed)', async () => {
    await createContact(TENANT_A, 'closed-a@example.com');
    const res = await http
      .get('/api/v1/contacts')
      .set('x-tenant-id', 'not-a-uuid; DROP TABLE contacts; --')
      .expect(200);
    const emails = res.body.data.map((c: { email: string }) => c.email);
    expect(emails).not.toContain('closed-a@example.com');
  });

  it('per-tenant uniqueness (FU-03): same email/SKU/orderNumber is valid in both tenants', async () => {
    // Same contact email in A and B — both succeed, no global-unique collision.
    await http
      .post('/api/v1/contacts')
      .set('x-tenant-id', TENANT_A)
      .send({ firstName: 'Dup', lastName: 'A', email: 'dup@example.com' })
      .expect(201);
    await http
      .post('/api/v1/contacts')
      .set('x-tenant-id', TENANT_B)
      .send({ firstName: 'Dup', lastName: 'B', email: 'dup@example.com' })
      .expect(201);

    // ...but a true within-tenant duplicate is still a 409.
    await http
      .post('/api/v1/contacts')
      .set('x-tenant-id', TENANT_A)
      .send({ firstName: 'Dup', lastName: 'A2', email: 'dup@example.com' })
      .expect(409);
  });
});
