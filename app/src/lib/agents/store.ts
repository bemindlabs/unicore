import type { VirtualOfficeAgent } from "./types";
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

function getCached(): VirtualOfficeAgent[] {
  if (typeof window === "undefined") return defaultAgents;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as VirtualOfficeAgent[];

    // Migrate from old localStorage key
    try {
      const legacy = localStorage.getItem("unicore_backoffice_agents");
      if (legacy) {
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem("unicore_backoffice_agents");
        return JSON.parse(legacy) as VirtualOfficeAgent[];
      }
    } catch {
      // ignore migration errors
    }

    return defaultAgents;
  } catch {
    return defaultAgents;
  }
}

function setCache(agents: VirtualOfficeAgent[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

export async function getAgents(): Promise<{
  agents: VirtualOfficeAgent[];
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
  agent: VirtualOfficeAgent,
): Promise<VirtualOfficeAgent[]> {
  await api.post("/api/proxy/openclaw/agents", agent);
  const agents = [...getCached(), agent];
  setCache(agents);
  return agents;
}

export async function updateAgent(
  updated: VirtualOfficeAgent,
): Promise<VirtualOfficeAgent[]> {
  await api.put(`/api/proxy/openclaw/agents/${updated.id}`, updated);
  const agents = getCached().map((a) => (a.id === updated.id ? updated : a));
  setCache(agents);
  return agents;
}

export async function deleteAgent(id: string): Promise<VirtualOfficeAgent[]> {
  await api.delete(`/api/proxy/openclaw/agents/${id}`);
  const agents = getCached().filter((a) => a.id !== id);
  setCache(agents);
  return agents;
}
