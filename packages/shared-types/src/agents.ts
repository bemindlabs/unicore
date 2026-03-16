// Agent Types

export enum AgentType {
  Router = 'router',
  Comms = 'comms',
  Finance = 'finance',
  Growth = 'growth',
  Ops = 'ops',
  Research = 'research',
  Erp = 'erp',
  Builder = 'builder',
}

export enum AutonomyLevel {
  FullAuto = 'full_auto',
  Approval = 'approval',
  Suggest = 'suggest',
}

export type AgentChannel =
  | 'line'
  | 'facebook'
  | 'instagram'
  | 'web'
  | 'email'
  | 'sms'
  | 'slack'
  | 'whatsapp'
  | 'telegram';

export interface AgentMessage {
  id: string;
  agentId: string;
  channel: AgentChannel;
  direction: 'inbound' | 'outbound';
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AgentTask {
  id: string;
  agentId: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  completedAt?: string;
}
