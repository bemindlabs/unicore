export interface TemplateErpConfig {
  contacts: boolean;
  orders: boolean;
  inventory: boolean;
  invoicing: boolean;
  expenses: boolean;
  reports: boolean;
}

export interface TemplateAgentsConfig {
  comms: boolean;
  finance: boolean;
  growth: boolean;
  ops: boolean;
  research: boolean;
  erp: boolean;
  builder: boolean;
}

export interface TemplateDashboardConfig {
  widgets: string[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  erp: TemplateErpConfig;
  agents: TemplateAgentsConfig;
  dashboard: TemplateDashboardConfig;
  channels: string[];
  workflows: string[];
}
