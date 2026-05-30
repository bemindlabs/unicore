/**
 * Tenancy / deployment-mode configuration (SaaS phase 4.0).
 *
 * UniCore runs in one of two modes via the `DEPLOYMENT_MODE` env var:
 *
 *  - `self-host` (default, open-core): a single implicit default tenant is used
 *    everywhere. Multi-tenant enforcement is disabled — behavior is identical to
 *    the pre-tenancy build.
 *  - `saas`: multi-tenant enforcement is active; tenant context is resolved from
 *    the JWT `tid` claim and propagated to downstream services.
 *
 * The legacy `ENABLE_MULTI_TENANT=true` flag is honored as an alias for
 * `DEPLOYMENT_MODE=saas` for backward compatibility.
 */

export type DeploymentMode = 'self-host' | 'saas';

/**
 * The implicit tenant used in self-host mode and as the backfill target for
 * existing rows. Stable, well-known, all-zero UUID.
 */
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';

/** Resolve the effective deployment mode from the environment. */
export function getDeploymentMode(): DeploymentMode {
  const raw = (process.env.DEPLOYMENT_MODE || '').trim().toLowerCase();
  if (raw === 'saas') return 'saas';
  if (raw === 'self-host') return 'self-host';

  // Backward-compat alias: ENABLE_MULTI_TENANT=true → saas.
  const legacy = (process.env.ENABLE_MULTI_TENANT || '').trim().toLowerCase();
  if (legacy === 'true' || legacy === '1') return 'saas';

  return 'self-host';
}

/** True when running as the Bemind-hosted multi-tenant SaaS. */
export function isSaaS(): boolean {
  return getDeploymentMode() === 'saas';
}

/** True when running as a self-hosted single-tenant deployment (default). */
export function isSelfHost(): boolean {
  return !isSaaS();
}

/**
 * Resolve the tenant id to use for a request.
 *
 * In self-host mode this is always {@link DEFAULT_TENANT_ID}. In saas mode the
 * resolved tenant id from the JWT (`tid`) is used; when none is available it
 * falls back to the default constant so the gateway always forwards a value
 * (fail-closed at the proxy layer).
 */
export function getDefaultTenantId(): string {
  return DEFAULT_TENANT_ID;
}

/**
 * Pick the effective tenant id given an optional resolved value from the JWT.
 * Self-host: always the default tenant. SaaS: the resolved value, or the
 * default constant when absent.
 */
export function resolveTenantId(tenantIdFromContext?: string | null): string {
  if (isSelfHost()) return DEFAULT_TENANT_ID;
  return tenantIdFromContext || DEFAULT_TENANT_ID;
}
