export type LicenseTier = 'community' | 'pro' | 'enterprise';

export type ProFeature =
  | 'advanced_agents'
  | 'rbac'
  | 'sso'
  | 'audit_log'
  | 'multi_channel'
  | 'white_label'
  | 'priority_support'
  | 'custom_integrations';

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
