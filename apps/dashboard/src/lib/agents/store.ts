import type { BackofficeAgent } from "./types";
import { defaultAgents, mapApiAgent } from "./agents";
import { api } from "@/lib/api";

const STORAGE_KEY = "unicore_agents";

interface OpenClawAgent {
  id: string;
  name?: string;
  type: string;
  state: string;
  capabilities?: string[];
  [key: string]: unknown;
}

interface AgentsResponse {
  agents: OpenClawAgent[];
}

function getCached(): BackofficeAgent[] {
  if (typeof window === "undefined") return defaultAgents;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as BackofficeAgent[]) : defaultAgents;
  } catch {
    return defaultAgents;
  }
}

function setCache(agents: BackofficeAgent[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

export async function getAgents(): Promise<{
  agents: BackofficeAgent[];
  cached: boolean;
}> {
  try {
    const data = await api.get<AgentsResponse>(
      "/api/proxy/openclaw/health/agents",
    );
    const agents =
      data.agents.length > 0 ? data.agents.map(mapApiAgent) : defaultAgents;
    setCache(agents);
    return { agents, cached: false };
  } catch {
    return { agents: getCached(), cached: true };
  }
}

export async function addAgent(
  agent: BackofficeAgent,
): Promise<BackofficeAgent[]> {
  await api.post("/api/proxy/openclaw/agents", agent);
  const agents = [...getCached(), agent];
  setCache(agents);
  return agents;
}

export async function updateAgent(
  updated: BackofficeAgent,
): Promise<BackofficeAgent[]> {
  await api.put(`/api/proxy/openclaw/agents/${updated.id}`, updated);
  const agents = getCached().map((a) => (a.id === updated.id ? updated : a));
  setCache(agents);
  return agents;
}

export async function deleteAgent(id: string): Promise<BackofficeAgent[]> {
  await api.delete(`/api/proxy/openclaw/agents/${id}`);
  const agents = getCached().filter((a) => a.id !== id);
  setCache(agents);
  return agents;
}
