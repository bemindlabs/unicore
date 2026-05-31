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

const storage = new AsyncLocalStorage<TenantStore>();

export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return storage.run({ tenantId }, fn);
}

/** Current request's tenant id, or the demo tenant outside any request. */
export function getTenantId(): string {
  return storage.getStore()?.tenantId ?? DEMO_TENANT_ID;
}

export function isValidTenantId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
