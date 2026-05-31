import { AsyncLocalStorage } from 'node:async_hooks';
import { DEMO_TENANT_ID } from './tenancy.config';

/**
 * Request-scoped tenant store for the api-gateway's OWN database queries
 * (SaaS phase 4.5).
 *
 * The gateway resolves the trusted tenant from the JWT `tid` claim (see
 * jwt.strategy.ts) and attaches it to `req`. The {@link TenantContextInterceptor}
 * copies that value into this AsyncLocalStorage so the gateway PrismaService can
 * issue `SET LOCAL app.tenant_id` per transaction against the gateway DB
 * (Settings, tasks, conversations, …).
 *
 * Outside any request (or for bootstrap paths) the value falls back to the
 * local/demo bootstrap tenant {@link DEMO_TENANT_ID}.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TenantStore {
  tenantId: string;
}

/**
 * Process-wide singleton AsyncLocalStorage. Pinned on globalThis so that even if
 * this module is instantiated more than once (e.g. a bundler/test-runner that
 * loads it via two resolved paths), every copy shares ONE store — otherwise
 * `runWithTenant` in one copy would be invisible to `getTenantId` in another,
 * silently dropping the tenant context and (with RLS) hiding every row. The
 * type is erased at the boundary, so a single declaration is safe.
 */
const STORE_KEY = Symbol.for('unicore.gateway.tenantStore');
const g = globalThis as unknown as Record<symbol, AsyncLocalStorage<TenantStore>>;
const storage: AsyncLocalStorage<TenantStore> =
  g[STORE_KEY] ?? (g[STORE_KEY] = new AsyncLocalStorage<TenantStore>());

/**
 * Run `fn` with the given tenant pinned in the request-scoped store.
 *
 * IMPORTANT (RLS correctness): the gateway PrismaService reads {@link getTenantId}
 * lazily, at query-EXECUTION time, inside its `SET LOCAL app.tenant_id`
 * transaction. A Prisma client call (`prisma.x.findMany()`) returns a LAZY
 * PrismaPromise whose execution only begins when it is awaited. If a caller does
 * `runWithTenant(id, () => prisma.x.findMany())`, the run-scope ends the instant
 * the lazy promise is returned, so the await — and thus `getTenantId()` — happens
 * OUTSIDE the context and silently falls back to the DEMO tenant, which under RLS
 * hides every row (or fails a WITH CHECK). To make every call site correct
 * regardless of whether it passes an eager `async` or a lazy thenable, we keep
 * the context active until a returned thenable settles.
 */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return storage.run({ tenantId }, () => {
    const result = fn() as T;
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      // Re-await inside the active context so the lazy promise's execution (and
      // the extension's getTenantId() call) runs while the tenant is pinned.
      return Promise.resolve(result) as unknown as T;
    }
    return result;
  });
}

/** Current request's tenant id, or the demo tenant outside any request. */
export function getTenantId(): string {
  return storage.getStore()?.tenantId ?? DEMO_TENANT_ID;
}

export function isValidTenantId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
