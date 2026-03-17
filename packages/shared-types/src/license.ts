// License Types — aligned with unicore-license/openapi.yaml

export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'invalid';

export interface LicenseFeatureFlags {
  allAgents: boolean;
  customAgentBuilder: boolean;
  fullRbac: boolean;
  advancedWorkflows: boolean;
  allChannels: boolean;
  unlimitedRag: boolean;
  whiteLabelBranding: boolean;
  sso: boolean;
  auditLogs: boolean;
  prioritySupport: boolean;
}

export interface LicenseInfo {
  key: string;
  edition: 'community' | 'pro';
  status: LicenseStatus;
  maxAgents: number;
  maxRoles: number;
  expiresAt: string;
  features: LicenseFeatureFlags;
}
