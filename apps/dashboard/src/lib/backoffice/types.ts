export type AgentStatus = 'working' | 'idle' | 'offline';

export type RoomId = 'conference' | 'main-office' | 'standalone' | 'bedroom' | 'shop';

export interface BackofficeAgent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  room: RoomId;
  activity?: string;
  color: string;
  deskItems?: string[];
}
