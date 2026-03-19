export type LicenseTier = 'community' | 'pro' | 'enterprise';

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
  | 'prioritySupport';

export interface LicenseStatus {
  valid: boolean;
  tier: LicenseTier;
  key: string | null;
  features: ProFeature[];
  expiresAt: Date | null;
  validatedAt: Date;
  nextRevalidationAt: Date;
}

export interface LicenseValidationResponse {
  valid: boolean;
  tier: LicenseTier;
  features: ProFeature[];
  expiresAt: string | null;
  message?: string;
}
