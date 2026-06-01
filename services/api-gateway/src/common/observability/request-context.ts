import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request-scoped observability context (GAPS #15).
 *
 * Carries the per-request correlation fields used by the structured logger
 * (and any other observability hook). Kept separate from the tenant store
 * (`tenant-store.ts`) so the tenant ALS stays single-purpose (RLS pinning),
 * while this one holds the log-correlation trio. `tenantId` is read live from
 * the tenant store at log time, so it is intentionally NOT duplicated here.
 *
 * Pinned on globalThis (same rationale as the tenant store) so a single store
 * is shared even if the module is loaded via two resolved paths.
 */
export interface RequestContext {
  requestId: string;
  userId?: string;
}

const STORE_KEY = Symbol.for('unicore.gateway.requestContext');
const g = globalThis as unknown as Record<
  symbol,
  AsyncLocalStorage<RequestContext>
>;
const storage: AsyncLocalStorage<RequestContext> =
  g[STORE_KEY] ??
  (g[STORE_KEY] = new AsyncLocalStorage<RequestContext>());

/** Run `fn` with the given request context pinned for the async scope. */
export function runWithRequestContext<T>(
  ctx: RequestContext,
  fn: () => T,
): T {
  return storage.run(ctx, fn);
}

/** Current request's context, or undefined outside any request. */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Late-bind the resolved userId once auth has run (mutates the active store). */
export function setRequestUserId(userId: string | undefined): void {
  const store = storage.getStore();
  if (store && userId) {
    store.userId = userId;
  }
}
