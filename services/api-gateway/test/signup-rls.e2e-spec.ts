/**
 * Signup-under-RLS coverage (membership-INSERT WITH CHECK regression).
 *
 * The `memberships` table is FORCE ROW LEVEL SECURITY with
 *   WITH CHECK ("tenantId" = current_setting('app.tenant_id', true))
 * (scripts/apply-rls.sql, GAPS #5). Every path that creates a Membership for a
 * BRAND-NEW tenant therefore has to issue the INSERT inside that tenant's
 * context (SET LOCAL app.tenant_id = <newTenant>), otherwise Postgres rejects it
 * with 42501 ("new row violates row-level security policy"). Under the local
 * SUPERUSER stack RLS is bypassed and the bug is invisible; under the required
 * NOSUPERUSER / NOBYPASSRLS role it 500s — signup, /auth/register, OAuth
 * new-user, and "create a 2nd business" all break.
 *
 * This suite boots the REAL gateway (AppModule) connected AS the
 * NOSUPERUSER/NOBYPASSRLS role (scripts/apply-rls.sql), runs **signup**
 * end-to-end over HTTP, and asserts:
 *
 *   1. POST /auth/signup → 201 with tokens (no 500 / 42501).
 *   2. A Tenant was created and an OWNER Membership(user, tenant) exists
 *      (verified via a privileged read, since the row is RLS-scoped).
 *   3. The membership's tenantId equals the signup token's `tid` (the new
 *      tenant) — i.e. it landed in the right tenant, not the demo tenant.
 *   4. The user can switch INTO that business: POST /tenants/switch → 200.
 *   5. /auth/register exercises the same shared primitive → 201 + membership.
 *
 * Gated on RLS_DATABASE_URL exactly like cross-tenant-leak.e2e-spec.ts — a skip
 * is NOT a pass. Live execution belongs to a Postgres job with a
 * NOSUPERUSER/NOBYPASSRLS role + apply-rls.sql applied.
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '../src/generated/prisma';

const RLS_URL = process.env.RLS_DATABASE_URL;
// Privileged connection (table owner — bypasses RLS) used ONLY for assertions
// and cleanup, mirroring a real seed/backfill. The gateway app under test still
// connects as the NOSUPERUSER role (RLS_URL), so signup itself exercises the
// live WITH CHECK policy.
const SEED_URL =
  process.env.SEED_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:55432/unicore';
const JWT_SECRET = 'test-tenant-isolation-secret-at-least-32-chars-long';

const maybe = RLS_URL ? describe : describe.skip;

maybe('Signup under RLS — membership INSERT WITH CHECK (regression)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let seed: PrismaClient;
  let http: ReturnType<typeof request>;

  const uniqueEmail = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@signup-rls.test`;

  beforeAll(async () => {
    process.env.DATABASE_URL = RLS_URL;
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.DEPLOYMENT_MODE = 'saas';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    http = request(app.getHttpServer());
    jwt = app.get(JwtService);

    seed = new PrismaClient({ datasources: { db: { url: SEED_URL } } });
    await seed.$connect();
  });

  afterAll(async () => {
    if (seed) await seed.$disconnect();
    if (app) await app.close();
  });

  it('signup creates the Tenant + OWNER Membership in the new tenant context (no 42501)', async () => {
    const email = uniqueEmail('owner');
    const res = await http
      .post('/auth/signup')
      .send({
        email,
        password: 'Sup3rSecret!',
        name: 'Owner One',
        businessName: 'Owner One Co',
      })
      .expect(201);

    expect(res.body.accessToken).toBeTruthy();
    const decoded = jwt.decode(res.body.accessToken) as { sub: string; tid: string };
    expect(decoded.tid).toBeTruthy();

    // The created user + tenant (privileged reads; Tenant/User are not RLS-scoped).
    const user = await seed.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();
    expect(user!.activeTenantId).toBe(decoded.tid);
    expect(user!.tenantId).toBe(decoded.tid);

    const tenant = await seed.tenant.findUnique({ where: { id: decoded.tid } });
    expect(tenant).toBeTruthy();

    // The OWNER Membership must exist AND be tagged to the new tenant — proving
    // the INSERT passed WITH CHECK in that tenant's context.
    const membership = await seed.membership.findUnique({
      where: { userId_tenantId: { userId: user!.id, tenantId: decoded.tid } },
    });
    expect(membership).toBeTruthy();
    expect(membership!.role).toBe('OWNER');
    expect(membership!.tenantId).toBe(decoded.tid);
  });

  it('the new owner can switch INTO their business (membership is visible under its own context)', async () => {
    const email = uniqueEmail('switcher');
    const signup = await http
      .post('/auth/signup')
      .send({ email, password: 'Sup3rSecret!', name: 'Switcher', businessName: 'Switch Co' })
      .expect(201);

    const token = signup.body.accessToken as string;
    const { tid } = jwt.decode(token) as { tid: string };

    const res = await http
      .post('/tenants/switch')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: tid })
      .expect(200);

    expect(res.body.accessToken).toBeTruthy();
    const decoded = jwt.decode(res.body.accessToken) as { tid?: string };
    expect(decoded.tid).toBe(tid);
  });

  it('/auth/register uses the same primitive → 201 + OWNER Membership in the new tenant', async () => {
    const email = uniqueEmail('register');
    const res = await http
      .post('/auth/register')
      .send({ email, password: 'Sup3rSecret!', name: 'Reg User' })
      .expect(201);

    const { sub, tid } = jwt.decode(res.body.accessToken) as { sub: string; tid: string };
    const membership = await seed.membership.findUnique({
      where: { userId_tenantId: { userId: sub, tenantId: tid } },
    });
    expect(membership).toBeTruthy();
    expect(membership!.tenantId).toBe(tid);
  });
});
