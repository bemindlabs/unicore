import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request-scoped tenant context for the ERP service (SaaS phase 4.5).
 *
 * The api-gateway resolves the trusted tenant from the JWT `tid` claim (or the
 * self-host default) and forwards it as the `x-tenant-id` header — exactly the
 * same trust model ERP already uses for `x-user-id`. {@link TenantContextMiddleware}
 * captures that header into this AsyncLocalStorage so the PrismaService can
 * issue `SET LOCAL app.tenant_id` per transaction, and services can apply
 * belt-and-braces `where: { tenantId }` filters.
 *
 * In self-host mode the value is always {@link DEFAULT_TENANT_ID}, so RLS is a
 * no-op pass-through and behavior is unchanged.
 */

/** Stable, well-known all-zero default tenant (self-host + backfill target). */
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TenantStore {
  tenantId: string;
}

const storage = new AsyncLocalStorage<TenantStore>();

/** Run `fn` within a tenant-scoped context. */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return storage.run({ tenantId }, fn);
}

/**
 * The tenant id for the current request, or the default tenant when no context
 * has been established (e.g. background jobs, Kafka consumers). Never returns
 * an empty value so the PrismaService SET LOCAL always has a valid uuid.
 */
export function getTenantId(): string {
  return storage.getStore()?.tenantId ?? DEFAULT_TENANT_ID;
}

/** True when the supplied value is a syntactically valid UUID. */
export function isValidTenantId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
