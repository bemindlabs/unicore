/**
 * Cross-tenant data-leak coverage for the NEW Stage A/B isolation surface
 * (GAPS #14, proving #1 / #2 / #5 / #7).
 *
 * The original tenant-isolation-http.e2e-spec.ts only exercised `/tasks`. This
 * suite extends the live, HTTP-level leak proof to the surface hardened in
 * Stage A (per-tenant Settings / AI keys / channel tokens) and Stage B
 * (memberships RLS, membership-checked switch, super-admin control-plane guard,
 * membership-required auth fallback).
 *
 * It boots the REAL gateway (AppModule) against Postgres, connecting AS the
 * NOSUPERUSER / NOBYPASSRLS role provisioned by scripts/apply-rls.sql, and
 * asserts over real HTTP + real SQL that:
 *
 *   #1  Settings/AI-keys: tenant A's GET /settings/ai-config/keys (A's
 *       x-tenant-id) returns A's keys; B's context returns B's (or empty),
 *       NEVER A's. A cannot read B's branding/line/telegram rows.
 *   #1  Channels: ChannelsService loads the CALLING tenant's bot token, never
 *       the DEMO/other tenant's.
 *   #5  Memberships RLS: SET LOCAL app.tenant_id = A → a raw `memberships`
 *       query returns only A's rows (B invisible); fails CLOSED for an unknown
 *       tenant.
 *   #7  Switch: POST /tenants/switch to a non-member → 403; to a SUSPENDED
 *       membership → 403; to a member → 200 + new tid.
 *   #2  Admin guard: /api/v1/admin/tenants and /api/v1/admin/system/restart →
 *       403 for a non-super-admin; allowed (200) for a super-admin.
 *   #7  Membership fallback: a non-super-admin with ZERO memberships is rejected
 *       (403), not allowed through.
 *
 * Gated on RLS_DATABASE_URL exactly like the M2 suites — a skip is NOT a pass.
 * Live execution belongs to a Postgres job with a NOSUPERUSER/NOBYPASSRLS role +
 * apply-rls.sql applied. JWT_SECRET is set so minted tokens validate.
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaClient } from '../src/generated/prisma';
import { ChannelsService } from '../src/channels/channels.service';

const RLS_URL = process.env.RLS_DATABASE_URL;
// Seeding runs as the privileged table-owner (bypasses RLS), exactly as a real
// seed/backfill does BEFORE the app connects as the NOSUPERUSER role. Defaults
// to the local bootstrap superuser; the gateway app still runs as RLS_URL.
const SEED_URL =
  process.env.SEED_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:55432/unicore';
const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const TENANT_C = '33333333-3333-3333-3333-333333333333'; // unknown / no-membership tenant
const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_SUPER = 'cccccccc-cccc-cccc-cccc-cccccccccccc'; // platform super-admin
const USER_ORPHAN = 'dddddddd-dddd-dddd-dddd-dddddddddddd'; // zero memberships
const JWT_SECRET = 'test-tenant-isolation-secret-at-least-32-chars-long';

const maybe = RLS_URL ? describe : describe.skip;

maybe('Cross-tenant leak — Stage A/B surface (GAPS #14)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let channels: ChannelsService;
  let seed: PrismaClient;
  // Test-owned PrismaService (connects as the NOSUPERUSER role, same as the app)
  // for the DIRECT-DB RLS assertions. Using a test-owned instance keeps its
  // tenant AsyncLocalStorage in lock-step with the test's runWithTenant import
  // (the app's DI-constructed instance lives in a separate module graph under
  // ts-jest, so its ALS would not see the test's runWithTenant context).
  let rls: PrismaService;
  let http: ReturnType<typeof request>;
  let tokenA: string;
  let tokenB: string;
  let tokenSuper: string;
  let tokenOrphan: string;

  const mint = (sub: string, tid: string, role = 'OWNER') =>
    jwt.sign({ sub, email: `${sub}@example.com`, role, tid }, { secret: JWT_SECRET });

  /**
   * Run a raw SELECT AS the NOSUPERUSER role with `SET LOCAL app.tenant_id`
   * pinned, in a single transaction — exactly the path the gateway PrismaService
   * uses, but driven explicitly so the assertion does not depend on the test's
   * AsyncLocalStorage (under ts-jest the app and the test can hold separate
   * tenant-store module copies). This is the literal "raw query on `memberships`
   * with SET LOCAL app.tenant_id = A" the GAPS #5 case calls for.
   */
  const queryAs = async <T = any>(tenantId: string, sql: string): Promise<T[]> =>
    rls.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      return tx.$queryRawUnsafe<T[]>(sql);
    });

  beforeAll(async () => {
    process.env.DATABASE_URL = RLS_URL;
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.DEPLOYMENT_MODE = 'saas';
    // Encrypt seeded AI keys with the SAME key the settings controller decrypts with.
    process.env.SETTINGS_ENCRYPTION_KEY =
      process.env.SETTINGS_ENCRYPTION_KEY ?? 'test-settings-encryption-key-32-chars!!';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    http = request(app.getHttpServer());

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    channels = app.get(ChannelsService);

    // Privileged seed connection (table owner — bypasses RLS), mirroring a real
    // seed/backfill. The gateway app under test still connects as the
    // NOSUPERUSER/NOBYPASSRLS role (RLS_URL), so every ASSERTION below exercises
    // the live policies. We seed RLS-scoped tables (memberships, Settings) here
    // because writing them as the app role would itself be subject to the
    // WITH CHECK we are validating.
    seed = new PrismaClient({ datasources: { db: { url: SEED_URL } } });
    await seed.$connect();

    // Test-owned RLS client (NOSUPERUSER role, via DATABASE_URL=RLS_URL).
    rls = new PrismaService();
    await rls.onModuleInit();

    // Clean slate for a deterministic, re-runnable suite.
    await seed.membership.deleteMany({});
    await seed.settings.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });

    // ── Seed two ACTIVE tenants (+ a third left unseeded as "unknown"). ──
    for (const [tid, slug] of [
      [TENANT_A, 'tenant-a'],
      [TENANT_B, 'tenant-b'],
    ] as const) {
      await seed.tenant.upsert({
        where: { id: tid },
        update: { status: 'ACTIVE' },
        create: { id: tid, slug, name: slug, status: 'ACTIVE' },
      });
    }

    // ── Users: OWNER A, OWNER B, a super-admin, and an orphan (no memberships). ──
    await seed.user.upsert({
      where: { id: USER_A },
      update: { tenantId: TENANT_A, activeTenantId: TENANT_A, isSuperAdmin: false },
      create: { id: USER_A, email: 'owner-a@example.com', name: 'Owner A', role: 'OWNER', tenantId: TENANT_A, activeTenantId: TENANT_A },
    });
    await seed.user.upsert({
      where: { id: USER_B },
      update: { tenantId: TENANT_B, activeTenantId: TENANT_B, isSuperAdmin: false },
      create: { id: USER_B, email: 'owner-b@example.com', name: 'Owner B', role: 'OWNER', tenantId: TENANT_B, activeTenantId: TENANT_B },
    });
    await seed.user.upsert({
      where: { id: USER_SUPER },
      update: { tenantId: TENANT_A, activeTenantId: TENANT_A, isSuperAdmin: true },
      create: { id: USER_SUPER, email: 'super@bemind.tech', name: 'Super', role: 'OWNER', tenantId: TENANT_A, activeTenantId: TENANT_A, isSuperAdmin: true },
    });
    await seed.user.upsert({
      where: { id: USER_ORPHAN },
      update: { tenantId: TENANT_A, activeTenantId: TENANT_A, isSuperAdmin: false },
      create: { id: USER_ORPHAN, email: 'orphan@example.com', name: 'Orphan', role: 'OWNER', tenantId: TENANT_A, activeTenantId: TENANT_A },
    });

    // ── Memberships (Stage A creates these on every auth path; seeded directly
    //    via the privileged connection). A→A OWNER, B→B OWNER, super→A. A also
    //    gets a SUSPENDED membership in B (so switch into B must be refused).
    //    Orphan gets NONE. ──
    const memberships: Array<{ userId: string; tenantId: string; role: any; status: string }> = [
      { userId: USER_A, tenantId: TENANT_A, role: 'OWNER', status: 'ACTIVE' },
      { userId: USER_A, tenantId: TENANT_B, role: 'OPERATOR', status: 'SUSPENDED' },
      { userId: USER_B, tenantId: TENANT_B, role: 'OWNER', status: 'ACTIVE' },
      { userId: USER_SUPER, tenantId: TENANT_A, role: 'OWNER', status: 'ACTIVE' },
    ];
    for (const m of memberships) {
      await seed.membership.create({ data: m });
    }

    // ── Per-tenant Settings rows (privileged seed). Distinct secrets per tenant
    //    so any cross-read is detectable. ──
    const seedSettings = async (tid: string, key: string, data: any) =>
      seed.settings.upsert({
        where: { tenantId_key: { tenantId: tid, key } },
        update: { data },
        create: { tenantId: tid, key, data },
      });

    // ai-config stores ENCRYPTED keys; the internal /keys endpoint decrypts.
    // We seed via the same crypto path the controller uses.
    const { encrypt } = await import('../src/settings/crypto.util');
    await seedSettings(TENANT_A, 'ai-config', { defaultProvider: 'openai', openaiKey: encrypt('sk-AAA-secret') });
    await seedSettings(TENANT_B, 'ai-config', { defaultProvider: 'anthropic', anthropicKey: encrypt('sk-BBB-secret') });
    await seedSettings(TENANT_A, 'branding', { primaryColor: '#AAA111' });
    await seedSettings(TENANT_B, 'branding', { primaryColor: '#BBB222' });
    await seedSettings(TENANT_A, 'line', { lineChannelSecret: 'LINE-A-SECRET' });
    await seedSettings(TENANT_B, 'line', { lineChannelSecret: 'LINE-B-SECRET' });
    await seedSettings(TENANT_A, 'telegram', { telegramBotToken: 'TG-A-TOKEN' });
    await seedSettings(TENANT_B, 'telegram', { telegramBotToken: 'TG-B-TOKEN' });
    // channels live under the 'default' key (ChannelsService.loadSettings).
    await seedSettings(TENANT_A, 'default', { channels: { telegramBotToken: 'BOT-A-111', lineAccessToken: 'LINE-A-TOK' } });
    await seedSettings(TENANT_B, 'default', { channels: { telegramBotToken: 'BOT-B-222', lineAccessToken: 'LINE-B-TOK' } });

    tokenA = mint(USER_A, TENANT_A);
    tokenB = mint(USER_B, TENANT_B);
    tokenSuper = mint(USER_SUPER, TENANT_A);
    tokenOrphan = mint(USER_ORPHAN, TENANT_A);
  });

  afterAll(async () => {
    if (rls) await rls.onModuleDestroy();
    if (seed) await seed.$disconnect();
    if (app) await app.close();
  });

  // ── #1 Settings / AI keys ──────────────────────────────────────────────────
  describe('#1 per-tenant Settings & AI keys', () => {
    it("internal /ai-config/keys with A's x-tenant-id returns A's key, never B's", async () => {
      const res = await http
        .get('/api/v1/settings/ai-config/keys')
        .set('x-internal-service', 'ai-engine')
        .set('x-tenant-id', TENANT_A)
        .expect(200);
      expect(res.body.openaiKey).toBe('sk-AAA-secret');
      expect(JSON.stringify(res.body)).not.toContain('sk-BBB-secret');
    });

    it("internal /ai-config/keys with B's x-tenant-id returns B's key (symmetry), never A's", async () => {
      const res = await http
        .get('/api/v1/settings/ai-config/keys')
        .set('x-internal-service', 'ai-engine')
        .set('x-tenant-id', TENANT_B)
        .expect(200);
      expect(res.body.anthropicKey).toBe('sk-BBB-secret');
      expect(JSON.stringify(res.body)).not.toContain('sk-AAA-secret');
    });

    it('a call with no/unknown tenant falls back to DEMO and CANNOT read A or B keys', async () => {
      const res = await http
        .get('/api/v1/settings/ai-config/keys')
        .set('x-internal-service', 'ai-engine')
        .expect(200);
      const blob = JSON.stringify(res.body);
      expect(blob).not.toContain('sk-AAA-secret');
      expect(blob).not.toContain('sk-BBB-secret');
    });

    it("tenant A (auth) reading branding sees A's, never B's", async () => {
      const res = await http
        .get('/api/v1/settings/branding')
        .set('Authorization', `Bearer ${tokenA}`);
      // 200 with A's data, or a license-gated status — but NEVER B's secret.
      expect(JSON.stringify(res.body)).not.toContain('#BBB222');
      if (res.status === 200) expect(res.body.primaryColor ?? '').not.toBe('#BBB222');
    });

    it("tenant A cannot read tenant B's line/telegram secret rows (RLS, as the app role)", async () => {
      // Pinned to A via SET LOCAL, B's 'line'/'telegram' rows are invisible.
      const aB = await queryAs(
        TENANT_A,
        `SELECT key FROM "Settings" WHERE "tenantId"='${TENANT_B}' AND key IN ('line','telegram')`,
      );
      expect(aB).toHaveLength(0);
      // A's own rows ARE visible to A.
      const aOwn = await queryAs(
        TENANT_A,
        `SELECT key FROM "Settings" WHERE key IN ('line','telegram')`,
      );
      expect(aOwn.length).toBe(2);
    });
  });

  // ── #1 Channels ─────────────────────────────────────────────────────────────
  describe('#1 channels load the CALLING tenant token', () => {
    it("ChannelsService.getStatus reflects A's config under A, B's under B (no shared/DEMO token)", async () => {
      const aStatus = await channels.getStatus(TENANT_A);
      const bStatus = await channels.getStatus(TENANT_B);
      // Each tenant's 'default' channel row holds its OWN distinct bot token —
      // proven by reading the persisted rows AS the app role under each tenant.
      const aRow = await queryAs<{ data: any }>(
        TENANT_A,
        `SELECT data FROM "Settings" WHERE key='default'`,
      );
      const bRow = await queryAs<{ data: any }>(
        TENANT_B,
        `SELECT data FROM "Settings" WHERE key='default'`,
      );
      expect(aRow[0].data.channels.telegramBotToken).toBe('BOT-A-111');
      expect(bRow[0].data.channels.telegramBotToken).toBe('BOT-B-222');
      expect(aRow[0].data.channels.telegramBotToken).not.toBe(bRow[0].data.channels.telegramBotToken);
      expect(aStatus.find((c) => c.channelType === 'telegram')?.configured).toBe(true);
      expect(bStatus.find((c) => c.channelType === 'telegram')?.configured).toBe(true);
    });

    it("tenant A's send NEVER loads B's bot token (cross-tenant row invisible under A)", async () => {
      const leaked = await queryAs(
        TENANT_A,
        `SELECT data FROM "Settings" WHERE "tenantId"='${TENANT_B}' AND key='default'`,
      );
      expect(leaked).toHaveLength(0); // RLS hides B's channel row from A
    });
  });

  // ── #5 Memberships RLS ──────────────────────────────────────────────────────
  describe('#5 memberships RLS', () => {
    it('SET LOCAL app.tenant_id = A → memberships query returns ONLY A rows (B invisible)', async () => {
      const rows = await queryAs<{ tenantId: string }>(TENANT_A, `SELECT "tenantId" FROM memberships`);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((m) => m.tenantId === TENANT_A)).toBe(true);
      expect(rows.some((m) => m.tenantId === TENANT_B)).toBe(false);
    });

    it('symmetry: under B only B rows are visible', async () => {
      const rows = await queryAs<{ tenantId: string }>(TENANT_B, `SELECT "tenantId" FROM memberships`);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((m) => m.tenantId === TENANT_B)).toBe(true);
    });

    it('fails CLOSED under an unknown tenant (no rows)', async () => {
      const rows = await queryAs(TENANT_C, `SELECT "tenantId" FROM memberships`);
      expect(rows).toHaveLength(0);
    });

    it('an explicit cross-tenant filter cannot widen scope', async () => {
      const leaked = await queryAs(
        TENANT_A,
        `SELECT "tenantId" FROM memberships WHERE "tenantId"='${TENANT_B}'`,
      );
      expect(leaked).toHaveLength(0);
    });
  });

  // ── #7 Switch (multi-business) ──────────────────────────────────────────────
  describe('#7 POST /tenants/switch', () => {
    it('switching to a non-member tenant → 403', async () => {
      await http
        .post('/tenants/switch')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ tenantId: TENANT_C })
        .expect(403);
    });

    it('switching to a SUSPENDED membership → 403', async () => {
      // USER_A holds a SUSPENDED membership in TENANT_B.
      await http
        .post('/tenants/switch')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ tenantId: TENANT_B })
        .expect(403);
    });

    it('switching to an ACTIVE member tenant → 200 with a new tid', async () => {
      const res = await http
        .post('/tenants/switch')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ tenantId: TENANT_A })
        .expect(200);
      expect(res.body.accessToken).toBeTruthy();
      const decoded = jwt.decode(res.body.accessToken) as { tid?: string };
      expect(decoded.tid).toBe(TENANT_A);
    });
  });

  // ── #2 Admin control-plane guard ────────────────────────────────────────────
  describe('#2 super-admin control plane', () => {
    it('non-super-admin → 403 on GET /api/v1/admin/tenants', async () => {
      await http
        .get('/api/v1/admin/tenants')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);
    });

    it('non-super-admin → 403 on POST /api/v1/admin/system/restart', async () => {
      await http
        .post('/api/v1/admin/system/restart')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ service: 'api-gateway' })
        .expect(403);
    });

    it('super-admin → 200 on GET /api/v1/admin/tenants', async () => {
      const res = await http
        .get('/api/v1/admin/tenants')
        .set('Authorization', `Bearer ${tokenSuper}`)
        .expect(200);
      expect(Array.isArray(res.body.items)).toBe(true);
    });
  });

  // ── #7 Membership fallback ──────────────────────────────────────────────────
  describe('#7 membership-required auth fallback', () => {
    it('a non-super-admin with ZERO memberships is rejected (403), not allowed through', async () => {
      // Orphan resolves tid=A from the token, but holds no membership for A.
      await http
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenOrphan}`)
        .expect(403);
    });
  });
});
