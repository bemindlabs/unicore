import type { BackofficeAgent } from './types';
import { defaultAgents } from './agents';

// Client-side store (localStorage persistence)
const STORAGE_KEY = 'unicore_backoffice_agents';

export function getAgents(): BackofficeAgent[] {
  if (typeof window === 'undefined') return defaultAgents;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : defaultAgents;
  } catch {
    return defaultAgents;
  }
}

export function saveAgents(agents: BackofficeAgent[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

export function addAgent(agent: BackofficeAgent): BackofficeAgent[] {
  const agents = getAgents();
  agents.push(agent);
  saveAgents(agents);
  return agents;
}

export function updateAgent(updated: BackofficeAgent): BackofficeAgent[] {
  const agents = getAgents().map(a => (a.id === updated.id ? updated : a));
  saveAgents(agents);
  return agents;
}

export function deleteAgent(id: string): BackofficeAgent[] {
  const agents = getAgents().filter(a => a.id !== id);
  saveAgents(agents);
  return agents;
}
