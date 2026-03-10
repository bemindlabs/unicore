export type AgentLifecycleState =
  | 'spawning'
  | 'running'
  | 'idle'
  | 'terminated';

export interface AgentCapability {
  name: string;
  version: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface AgentMetadata {
  id: string;
  name: string;
  type: string;
  version: string;
  capabilities: AgentCapability[];
  tags?: string[];
}

export interface RegisteredAgent {
  metadata: AgentMetadata;
  state: AgentLifecycleState;
  registeredAt: Date;
  lastHeartbeatAt: Date;
  lastStateChangeAt: Date;
  socketId: string;
}
