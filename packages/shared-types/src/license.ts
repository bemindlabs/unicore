// License Types

export type LicenseEdition = 'community' | 'pro';

export interface LicenseKey {
  key: string;
  edition: LicenseEdition;
  issuedTo: string;
  issuedAt: string;
  expiresAt: string;
}

export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'invalid';

export interface FeatureFlags {
  maxAgents: number;
  maxUsers: number;
  customWorkflows: boolean;
  advancedReporting: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean;
}

export interface LicenseInfo {
  key: string;
  edition: LicenseEdition;
  status: LicenseStatus;
  features: FeatureFlags;
  issuedTo: string;
  issuedAt: string;
  expiresAt: string;
}
