import type { VirtualOfficeAgent, AgentStatus, RoomId } from "./types";

interface OpenClawAgent {
  id: string;
  name?: string;
  type: string;
  state: string;
  capabilities?: string[];
  [key: string]: unknown;
}

const TYPE_CONFIG: Record<
  string,
  { role: string; color: string; room: RoomId; deskItems: string[] }
> = {
  router: {
    role: "System Orchestrator",
    color: "#00e5ff",
    room: "main-office",
    deskItems: ["triple-monitor", "server-rack"],
  },
  comms: {
    role: "Communications Agent",
    color: "#4fc3f7",
    room: "standalone",
    deskItems: ["monitors", "headset"],
  },
  finance: {
    role: "Finance Agent",
    color: "#81c784",
    room: "standalone",
    deskItems: ["monitors", "charts"],
  },
  growth: {
    role: "Growth & Marketing",
    color: "#ffb74d",
    room: "conference",
    deskItems: ["charts"],
  },
  ops: {
    role: "Operations Agent",
    color: "#ce93d8",
    room: "standalone",
    deskItems: ["monitors", "books"],
  },
  research: {
    role: "Research Agent",
    color: "#7c4dff",
    room: "standalone",
    deskItems: ["monitor", "galaxy-screen"],
  },
  erp: {
    role: "ERP Integration",
    color: "#f06292",
    room: "standalone",
    deskItems: ["books", "monitors"],
  },
  builder: {
    role: "Builder Agent",
    color: "#4dd0e1",
    room: "conference",
    deskItems: ["easel", "palette"],
  },
  sentinel: {
    role: "Security Monitor",
    color: "#ef5350",
    room: "standalone",
    deskItems: ["alert-light", "monitors"],
  },
};

function mapState(state: string): AgentStatus {
  const s = state.toLowerCase();
  if (s === "running" || s === "active" || s === "working") return "working";
  if (s === "stopped" || s === "error" || s === "offline") return "offline";
  return "idle";
}

export function mapApiAgent(apiAgent: OpenClawAgent): VirtualOfficeAgent {
  const type = (apiAgent.type || "").toLowerCase();
  const config = TYPE_CONFIG[type] ?? {
    role: type || "Agent",
    color: "#00e5ff",
    room: "standalone" as RoomId,
    deskItems: ["monitors"],
  };
  return {
    id: apiAgent.id,
    name: (apiAgent.name || apiAgent.type || apiAgent.id).toUpperCase(),
    role: config.role,
    status: mapState(apiAgent.state),
    room: config.room,
    color: config.color,
    deskItems: config.deskItems,
  };
}

export const defaultAgents: VirtualOfficeAgent[] = [
  {
    id: "router",
    name: "ROUTER",
    role: "System Orchestrator",
    status: "working",
    room: "main-office",
    activity: "Routing messages across channels...",
    color: "#00e5ff",
    deskItems: ["triple-monitor", "server-rack"],
  },
  {
    id: "comms",
    name: "COMMS",
    role: "Communications Agent",
    status: "idle",
    room: "standalone",
    activity: "Standby",
    color: "#4fc3f7",
    deskItems: ["monitors", "headset"],
  },
  {
    id: "finance",
    name: "FINANCE",
    role: "Finance Agent",
    status: "idle",
    room: "standalone",
    activity: "Standby",
    color: "#81c784",
    deskItems: ["monitors", "charts"],
  },
  {
    id: "growth",
    name: "GROWTH",
    role: "Growth & Marketing",
    status: "offline",
    room: "conference",
    activity: "Offline",
    color: "#ffb74d",
    deskItems: ["charts"],
  },
  {
    id: "ops",
    name: "OPS",
    role: "Operations Agent",
    status: "idle",
    room: "standalone",
    activity: "Standby",
    color: "#ce93d8",
    deskItems: ["monitors", "books"],
  },
  {
    id: "research",
    name: "RESEARCH",
    role: "Research Agent",
    status: "offline",
    room: "standalone",
    activity: "Offline",
    color: "#7c4dff",
    deskItems: ["monitor", "galaxy-screen"],
  },
  {
    id: "sentinel",
    name: "SENTINEL",
    role: "Security Monitor",
    status: "idle",
    room: "standalone",
    activity: "Standby",
    color: "#ef5350",
    deskItems: ["alert-light", "monitors"],
  },
  {
    id: "builder",
    name: "BUILDER",
    role: "Builder Agent",
    status: "offline",
    room: "conference",
    activity: "Offline",
    color: "#4dd0e1",
    deskItems: ["easel", "palette"],
  },
  {
    id: "erp",
    name: "ERP",
    role: "ERP Integration",
    status: "idle",
    room: "standalone",
    activity: "Standby",
    color: "#f06292",
    deskItems: ["books", "monitors"],
  },
];
