/**
 * Agent display labels — name and icon for each specialist agent type.
 * Used to label responses in the Omni-Channel Conversation Hub (UNC-1028).
 */

export interface AgentLabel {
  displayName: string;
  icon: string;
}

export const AGENT_LABEL_MAP: Record<string, AgentLabel> = {
  comms:    { displayName: 'Comms Agent',    icon: '📢' },
  finance:  { displayName: 'Finance Agent',  icon: '💰' },
  growth:   { displayName: 'Growth Agent',   icon: '📈' },
  ops:      { displayName: 'Ops Agent',      icon: '⚙️' },
  research: { displayName: 'Research Agent', icon: '🔬' },
  erp:      { displayName: 'ERP Agent',      icon: '🏢' },
  builder:  { displayName: 'Builder Agent',  icon: '🔧' },
  sentinel: { displayName: 'Sentinel Agent', icon: '🛡️' },
  router:   { displayName: 'Router',         icon: '🔀' },
  fallback: { displayName: 'Assistant',      icon: '🤖' },
};

/**
 * Return the display label for a given agent type.
 * Falls back to a generic "Agent" label if the type is unrecognised.
 */
export function getAgentLabel(agentType: string): AgentLabel {
  return AGENT_LABEL_MAP[agentType] ?? { displayName: 'Agent', icon: '🤖' };
}
