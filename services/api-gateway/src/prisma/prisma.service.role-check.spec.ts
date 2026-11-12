import { PrismaService } from './prisma.service';

/**
 * GAPS #4: PrismaService verifies on startup that the DB connection role cannot
 * bypass Row-Level Security (NOSUPERUSER / NOBYPASSRLS). A superuser/bypassrls
 * role silently disables every tenant-isolation policy.
 *
 *   - dev (no NODE_ENV/REQUIRE_RLS)  → LOUD warning, boot continues;
 *   - production OR REQUIRE_RLS=true → refuse to start (throw).
 *
 * The private `assertNotRlsBypassingRole` runs raw against the DB, so we test it
 * in isolation with a stubbed query + logger rather than a live connection.
 */
describe('PrismaService.assertNotRlsBypassingRole (GAPS #4)', () => {
  const ORIGINAL_ENV = { ...process.env };

  function build(roleRow: { rolsuper: boolean; rolbypassrls: boolean } | null) {
    // Avoid the real constructor (which calls $extends / would need a DB).
    const svc = Object.create(PrismaService.prototype) as PrismaService;
    const warn = jest.fn();
    const error = jest.fn();
    (svc as any).logger = { warn, error };
    (svc as any).$queryRawUnsafe = jest.fn(async () => (roleRow ? [roleRow] : []));
    return { svc, warn, error };
  }

  const run = (svc: PrismaService) =>
    (svc as any).assertNotRlsBypassingRole() as Promise<void>;

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NODE_ENV;
    delete process.env.REQUIRE_RLS;
  });

  it('a NOSUPERUSER / NOBYPASSRLS role passes silently', async () => {
    const { svc, warn, error } = build({ rolsuper: false, rolbypassrls: false });
    await expect(run(svc)).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('dev default: a superuser role WARNS but does not throw', async () => {
    delete process.env.NODE_ENV;
    delete process.env.REQUIRE_RLS;
    const { svc, warn } = build({ rolsuper: true, rolbypassrls: false });
    await expect(run(svc)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/RLS WARNING/);
  });

  it('production: a superuser role REFUSES to start (throws)', async () => {
    process.env.NODE_ENV = 'production';
    const { svc, error } = build({ rolsuper: true, rolbypassrls: false });
    await expect(run(svc)).rejects.toThrow(/RLS enforcement/);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('REQUIRE_RLS=true (non-prod): a BYPASSRLS role REFUSES to start (throws)', async () => {
    delete process.env.NODE_ENV;
    process.env.REQUIRE_RLS = 'true';
    const { svc } = build({ rolsuper: false, rolbypassrls: true });
    await expect(run(svc)).rejects.toThrow(/RLS enforcement/);
  });

  it('non-fatal when the role cannot be resolved (warn only)', async () => {
    process.env.NODE_ENV = 'production';
    const { svc, warn } = build(null);
    await expect(run(svc)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
