import {
  AgentType,
} from '@bemindlabs/unicore-shared-types';
import type {
  AgentChannel,
  AgentConfig,
  BusinessConfig,
  BusinessTemplate,
  ErpModulesConfig,
  IntegrationConfig,
  UserRole,
} from '@bemindlabs/unicore-shared-types';

export interface TeamMember {
  email: string;
  role: UserRole;
}

export interface AdminInfo {
  name: string;
  email: string;
  password: string;
}

export interface WizardState {
  currentStep: number;
  bootstrapSecret: string;
  business: BusinessConfig;
  admin: AdminInfo;
  team: TeamMember[];
  agents: AgentConfig[];
  erp: ErpModulesConfig;
  integrations: IntegrationConfig[];
}

export type WizardAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_BOOTSTRAP_SECRET'; secret: string }
  | { type: 'UPDATE_BUSINESS'; data: Partial<BusinessConfig> }
  | { type: 'UPDATE_ADMIN'; data: Partial<AdminInfo> }
  | { type: 'SET_TEAM'; team: TeamMember[] }
  | { type: 'ADD_TEAM_MEMBER'; member: TeamMember }
  | { type: 'REMOVE_TEAM_MEMBER'; index: number }
  | { type: 'UPDATE_AGENTS'; agents: AgentConfig[] }
  | { type: 'TOGGLE_AGENT'; agentIndex: number }
  | { type: 'UPDATE_AGENT'; agentIndex: number; data: Partial<AgentConfig> }
  | { type: 'UPDATE_ERP'; modules: Partial<ErpModulesConfig> }
  | { type: 'SET_INTEGRATIONS'; integrations: IntegrationConfig[] }
  | { type: 'TOGGLE_INTEGRATION'; index: number };

export const BUSINESS_TEMPLATES: { value: BusinessTemplate; label: string; description: string }[] = [
  { value: 'ecommerce', label: 'E-Commerce', description: 'Online store with products, orders, and shipping' },
  { value: 'freelance', label: 'Freelance', description: 'Solo services with invoicing and client management' },
  { value: 'agency', label: 'Agency', description: 'Creative or professional agency with client projects' },
  { value: 'saas', label: 'SaaS', description: 'Software subscriptions with recurring billing' },
  { value: 'retail', label: 'Retail', description: 'Physical or hybrid retail with POS and inventory' },
  { value: 'content_creator', label: 'Content Creator', description: 'Content production with audience and sponsorships' },
  { value: 'professional_services', label: 'Professional Services', description: 'Consulting, legal, or accounting with project tracking' },
  { value: 'custom', label: 'Custom', description: 'Start from scratch and configure everything' },
];

export const AVAILABLE_CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'THB', label: 'THB — Thai Baht' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
];

export const AVAILABLE_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Berlin', label: 'Central Europe (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

export const AVAILABLE_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'th', label: 'Thai' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
];

export const AGENT_DEFINITIONS: { type: AgentConfig['type']; name: string; description: string; defaultChannels: AgentChannel[] }[] = [
  { type: AgentType.Router, name: 'Router Agent', description: 'Intent classification and task delegation across agents', defaultChannels: ['web'] },
  { type: AgentType.Comms, name: 'Comms Agent', description: 'Email drafts, social media posts, and customer outreach', defaultChannels: ['email', 'web'] },
  { type: AgentType.Finance, name: 'Finance Agent', description: 'Transaction categorization, forecasting, and invoice generation', defaultChannels: ['web'] },
  { type: AgentType.Growth, name: 'Growth Agent', description: 'Funnel optimization, ad copy, and A/B test analysis', defaultChannels: ['web'] },
  { type: AgentType.Ops, name: 'Ops Agent', description: 'Task management, scheduling, and project tracking', defaultChannels: ['web', 'slack'] },
  { type: AgentType.Research, name: 'Research Agent', description: 'Market intelligence, competitor analysis, and trend reports', defaultChannels: ['web'] },
  { type: AgentType.Erp, name: 'ERP Agent', description: 'Natural language queries over your ERP data', defaultChannels: ['web'] },
  { type: AgentType.Builder, name: 'Builder Agent', description: 'Code generation, deployments, and technical scaffolding', defaultChannels: ['web'] },
  { type: AgentType.Sentinel, name: 'Sentinel Agent', description: 'Security monitoring, threat detection, and vulnerability scanning', defaultChannels: ['web'] },
];

export const ERP_MODULES: { key: keyof ErpModulesConfig; label: string; description: string }[] = [
  { key: 'contacts', label: 'Contacts & CRM', description: 'Customer management, lead tracking, and communication history' },
  { key: 'orders', label: 'Orders', description: 'Order processing, fulfillment, and status tracking' },
  { key: 'inventory', label: 'Inventory', description: 'Stock levels, SKU management, and reorder alerts' },
  { key: 'invoicing', label: 'Invoicing', description: 'Invoice generation, payment tracking, and reminders' },
  { key: 'expenses', label: 'Expenses', description: 'Expense tracking, categorization, and receipt management' },
  { key: 'reports', label: 'Reports', description: 'Financial reports, analytics dashboards, and exports' },
];

export const INTEGRATION_CATEGORIES = [
  {
    category: 'Payments',
    integrations: [
      { name: 'Stripe', provider: 'stripe', description: 'Payment processing and subscriptions' },
      { name: 'PayPal', provider: 'paypal', description: 'Online payment gateway' },
    ],
  },
  {
    category: 'Banking',
    integrations: [
      { name: 'Plaid', provider: 'plaid', description: 'Bank account linking and transactions' },
    ],
  },
  {
    category: 'Communication',
    integrations: [
      { name: 'SendGrid', provider: 'sendgrid', description: 'Transactional and marketing email' },
      { name: 'Twilio', provider: 'twilio', description: 'SMS and voice communications' },
      { name: 'Slack', provider: 'slack', description: 'Team messaging and notifications' },
    ],
  },
  {
    category: 'Marketing',
    integrations: [
      { name: 'Google Analytics', provider: 'google-analytics', description: 'Website and conversion analytics' },
      { name: 'Mailchimp', provider: 'mailchimp', description: 'Email marketing campaigns' },
    ],
  },
  {
    category: 'Storage',
    integrations: [
      { name: 'AWS S3', provider: 'aws-s3', description: 'Cloud file storage and CDN' },
      { name: 'Google Drive', provider: 'google-drive', description: 'Document storage and collaboration' },
    ],
  },
  {
    category: 'AI',
    integrations: [
      { name: 'OpenAI', provider: 'openai', description: 'GPT models for text generation' },
      { name: 'Anthropic', provider: 'anthropic', description: 'Claude models for AI assistance' },
    ],
  },
];

export const STEP_LABELS = [
  'Business Profile',
  'Team & Roles',
  'AI Agents',
  'ERP Modules',
  'Integrations',
  'Review & Launch',
];
