// Business & Config Types

import type { AgentType, AutonomyLevel } from './agents.js';
import type { UserRole } from './auth.js';

export type BusinessTemplate =
  | 'ecommerce'
  | 'freelance'
  | 'agency'
  | 'saas'
  | 'retail'
  | 'content_creator'
  | 'professional_services'
  | 'custom';

export interface ErpModulesConfig {
  contacts: boolean;
  orders: boolean;
  inventory: boolean;
  invoicing: boolean;
  expenses: boolean;
  reports: boolean;
}

export interface AgentConfig {
  type: AgentType;
  enabled: boolean;
  autonomy: AutonomyLevel;
  channels?: string[];
}

export interface ErpConfig {
  modules: ErpModulesConfig;
  currency: string;
  timezone: string;
}

export interface IntegrationConfig {
  name: string;
  enabled: boolean;
  provider: string;
  config: Record<string, unknown>;
}

export interface BusinessConfig {
  name: string;
  template: BusinessTemplate;
  industry?: string;
  locale: string;
  currency: string;
  timezone: string;
}

export interface RoleConfig {
  role: UserRole;
  enabled: boolean;
}

export interface UniCoreConfig {
  business: BusinessConfig;
  roles: RoleConfig[];
  agents: AgentConfig[];
  erp: ErpConfig;
  integrations: IntegrationConfig[];
}
