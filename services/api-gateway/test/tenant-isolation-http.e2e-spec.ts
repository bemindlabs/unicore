/**
 * Service-level cross-tenant leak test for the api-gateway (SaaS phase 4.5, FU-05).
 *
 * Where tenant-isolation.e2e-spec.ts exercises the gateway PrismaService/RLS at
 * the DB layer, and proxy.service.spec.ts unit-tests the `x-tenant-id`
 * injection point (spoofing rejection + trusted re-injection), THIS suite
 * proves isolation end-to-end over REAL HTTP through the booted gateway:
 *
 *   JWT `tid` claim -> JwtAuthGuard/jwt.strategy -> TenantContextInterceptor ->
 *   gateway PrismaService SET LOCAL app.tenant_id -> Postgres RLS.
 *
 * It asserts, over HTTP, that:
 *   - the tenant is governed by the trusted JWT `tid` claim, NOT a client
 *     `x-tenant-id` header — a spoofed header is ignored;
 *   - tenant A's token lists ONLY A's tasks; tenant B's token sees ONLY B's;
 *   - a request with NO Authorization is rejected (401) — the gateway never
 *     serves tenant-scoped data unauthenticated.
 *
 * Gated on RLS_DATABASE_URL exactly like the DB-layer suite (a skip is NOT a
 * pass — live execution belongs to a Postgres-backed CI job with a
 * NOSUPERUSER/NOBYPASSRLS role + apply-rls.sql). JWT_SECRET is set so the
 * minted tokens validate against the booted app's JwtModule.
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { runWithTenant } from '../src/common/tenancy/tenant-store';

const RLS_URL = process.env.RLS_DATABASE_URL;
const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const JWT_SECRET = 'test-tenant-isolation-secret-at-least-32-chars-long';

const maybe = RLS_URL ? describe : describe.skip;

maybe('Gateway tenant isolation over HTTP (service-level leak test)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let http: ReturnType<typeof request>;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = RLS_URL;
    process.env.JWT_SECRET = JWT_SECRET;
    // Multi-tenant enforcement: in self-host the JWT `tid` is ignored and every
    // request resolves to the default tenant. Cross-tenant isolation is a
    // saas-mode concern, so the leak test runs in saas mode.
    process.env.DEPLOYMENT_MODE = 'saas';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    http = request(app.getHttpServer());

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    // Seed two ACTIVE tenants + one user each (identity tables are not RLS-scoped).
    for (const [tid, slug] of [[TENANT_A, 'tenant-a'], [TENANT_B, 'tenant-b']] as const) {
      await prisma.tenant.upsert({
        where: { id: tid },
        update: { status: 'ACTIVE' },
        create: { id: tid, slug, name: slug, status: 'ACTIVE' },
      });
    }
    await prisma.user.upsert({
      where: { id: USER_A },
      update: { tenantId: TENANT_A },
      create: { id: USER_A, email: 'owner-a@example.com', name: 'Owner A', role: 'OWNER', tenantId: TENANT_A },
    });
    await prisma.user.upsert({
      where: { id: USER_B },
      update: { tenantId: TENANT_B },
      create: { id: USER_B, email: 'owner-b@example.com', name: 'Owner B', role: 'OWNER', tenantId: TENANT_B },
    });

    // Mint tokens WITHOUT jti so the strategy skips the Redis blacklist lookup.
    tokenA = jwt.sign({ sub: USER_A, email: 'owner-a@example.com', role: 'OWNER', tid: TENANT_A }, { secret: JWT_SECRET });
    tokenB = jwt.sign({ sub: USER_B, email: 'owner-b@example.com', role: 'OWNER', tid: TENANT_B }, { secret: JWT_SECRET });

    // Clean slate + seed one task per tenant in each tenant's RLS context.
    for (const t of [TENANT_A, TENANT_B]) {
      await runWithTenant(t, async () => {
        await prisma.task.deleteMany({});
      });
    }
    await runWithTenant(TENANT_A, async () =>
      prisma.task.create({ data: { tenantId: TENANT_A, title: 'Task A', creatorId: USER_A } }),
    );
    await runWithTenant(TENANT_B, async () =>
      prisma.task.create({ data: { tenantId: TENANT_B, title: 'Task B', creatorId: USER_B } }),
    );
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('rejects an unauthenticated request to a tenant-scoped endpoint (401)', async () => {
    await http.get('/api/v1/tasks').expect(401);
  });

  it("tenant A's token lists ONLY tenant A's tasks", async () => {
    const res = await http
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const titles = res.body.tasks.map((t: { title: string }) => t.title);
    expect(titles).toContain('Task A');
    expect(titles).not.toContain('Task B');
  });

  it("tenant B's token lists ONLY tenant B's tasks (symmetry)", async () => {
    const res = await http
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const titles = res.body.tasks.map((t: { title: string }) => t.title);
    expect(titles).toContain('Task B');
    expect(titles).not.toContain('Task A');
  });

  it('the trusted JWT tid wins — a spoofed x-tenant-id header cannot widen scope', async () => {
    // Tenant A's token, but the client lies with a B header. Scope MUST stay A.
    const res = await http
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', TENANT_B)
      .expect(200);
    const titles = res.body.tasks.map((t: { title: string }) => t.title);
    expect(titles).toContain('Task A');
    expect(titles).not.toContain('Task B');
  });
});
