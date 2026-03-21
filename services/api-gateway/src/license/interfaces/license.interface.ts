export type LicenseEdition = 'community' | 'pro' | 'enterprise';

/** @deprecated Use LicenseEdition instead. */
export type LicenseTier = LicenseEdition;

/**
 * Pro feature flag names — camelCase, aligned with
 * @unicore-license/license-types FeatureFlags keys.
 */
export type ProFeature =
  | 'allAgents'
  | 'customAgentBuilder'
  | 'fullRbac'
  | 'advancedWorkflows'
  | 'allChannels'
  | 'unlimitedRag'
  | 'whiteLabelBranding'
  | 'sso'
  | 'auditLogs'
  | 'prioritySupport'
  | 'aiDlc';

export interface LicenseStatus {
  valid: boolean;
  edition: LicenseEdition;
  key: string | null;
  features: ProFeature[];
  expiresAt: Date | null;
  validatedAt: Date;
  nextRevalidationAt: Date;
}

/**
 * Response from the License Server POST /v1/validate.
 * features is an object { allAgents: boolean, ... } from the server,
 * which buildStatusFromResponse() converts to ProFeature[].
 */
export interface LicenseValidationResponse {
  valid: boolean;
  edition?: string;
  /** @deprecated Use edition instead. */
  tier?: string;
  features: Record<string, boolean> | ProFeature[];
  expiresAt: string | null;
  cacheUntil?: string;
  message?: string;
}
