/**
 * Tenancy configuration.
 *
 * UniCore is a multi-tenant SaaS. Tenancy, row-level security, and the tenant
 * guards are ALWAYS enforced — there is no self-host / single-tenant mode. The
 * active tenant is resolved from the JWT `tid` claim and propagated to the
 * downstream services; a request with no resolvable tenant is an auth error,
 * not a silent default.
 */

/**
 * Stable, well-known, all-zero UUID reserved for the local/demo bootstrap
 * tenant seeded for development and demos (see {@link TenantSeedService}). It is
 * NOT a request-time fallback — production requests always carry a real tenant
 * id resolved from the JWT.
 */
export const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000000';

/** True — UniCore always runs as the Bemind-hosted multi-tenant SaaS. */
export function isSaaS(): boolean {
  return true;
}
