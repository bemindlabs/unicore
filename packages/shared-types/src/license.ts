// License Types — aligned with unicore-license/openapi.yaml

export type LicenseEdition = 'community' | 'pro';

export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'invalid';

export interface FeatureFlags {
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

export const COMMUNITY_DEFAULTS: FeatureFlags = {
  allAgents: false,
  customAgentBuilder: false,
  fullRbac: false,
  advancedWorkflows: false,
  allChannels: false,
  unlimitedRag: false,
  whiteLabelBranding: false,
  sso: false,
  auditLogs: false,
  prioritySupport: false,
};

export const PRO_DEFAULTS: FeatureFlags = {
  allAgents: true,
  customAgentBuilder: true,
  fullRbac: true,
  advancedWorkflows: true,
  allChannels: true,
  unlimitedRag: true,
  whiteLabelBranding: true,
  sso: true,
  auditLogs: true,
  prioritySupport: true,
};

export interface LicenseInfo {
  key: string;
  edition: LicenseEdition;
  status: LicenseStatus;
  features: FeatureFlags;
  maxAgents: number;
  maxRoles: number;
  expiresAt: string;
  cacheUntil?: string;
}

export interface MachineFingerprint {
  cpuId: string;
  macAddress: string;
  diskId: string;
  hash: string;
}

export const LICENSE_KEY_PATTERN = /^UC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
