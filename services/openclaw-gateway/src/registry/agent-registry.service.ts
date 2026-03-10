import { Injectable, Logger } from '@nestjs/common';
import {
  AgentCapability,
  AgentLifecycleState,
  AgentMetadata,
  RegisteredAgent,
} from './interfaces/agent.interface';

@Injectable()
export class AgentRegistryService {
  private readonly logger = new Logger(AgentRegistryService.name);

  /** agentId -> RegisteredAgent */
  private readonly agents = new Map<string, RegisteredAgent>();

  /** socketId -> agentId */
  private readonly socketToAgent = new Map<string, string>();

  register(
    metadata: AgentMetadata,
    socketId: string,
  ): RegisteredAgent {
    const now = new Date();

    const agent: RegisteredAgent = {
      metadata,
      state: 'spawning',
      registeredAt: now,
      lastHeartbeatAt: now,
      lastStateChangeAt: now,
      socketId,
    };

    this.agents.set(metadata.id, agent);
    this.socketToAgent.set(socketId, metadata.id);

    this.logger.log(
      `Agent registered: ${metadata.id} (${metadata.name}) via socket ${socketId}`,
    );

    // Transition to running after registration
    this.updateState(metadata.id, 'running');

    return agent;
  }

  unregister(agentId: string, reason?: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    this.updateState(agentId, 'terminated');
    this.socketToAgent.delete(agent.socketId);
    this.agents.delete(agentId);

    this.logger.log(
      `Agent unregistered: ${agentId}${reason ? ` — reason: ${reason}` : ''}`,
    );

    return true;
  }

  unregisterBySocket(socketId: string): RegisteredAgent | undefined {
    const agentId = this.socketToAgent.get(socketId);
    if (!agentId) return undefined;

    const agent = this.agents.get(agentId);
    if (!agent) return undefined;

    this.unregister(agentId, 'socket disconnected');
    return agent;
  }

  updateState(agentId: string, state: AgentLifecycleState): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    const prev = agent.state;
    agent.state = state;
    agent.lastStateChangeAt = new Date();

    this.logger.debug(`Agent ${agentId} state: ${prev} -> ${state}`);

    return true;
  }

  recordHeartbeat(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.lastHeartbeatAt = new Date();
    return true;
  }

  getAgent(agentId: string): RegisteredAgent | undefined {
    return this.agents.get(agentId);
  }

  getAgentBySocket(socketId: string): RegisteredAgent | undefined {
    const agentId = this.socketToAgent.get(socketId);
    if (!agentId) return undefined;
    return this.agents.get(agentId);
  }

  getSocketId(agentId: string): string | undefined {
    return this.agents.get(agentId)?.socketId;
  }

  getAllAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  findByCapability(capabilityName: string): RegisteredAgent[] {
    return this.getAllAgents().filter(
      (a) =>
        a.state !== 'terminated' &&
        a.metadata.capabilities.some((c: AgentCapability) => c.name === capabilityName),
    );
  }

  findByType(agentType: string): RegisteredAgent[] {
    return this.getAllAgents().filter(
      (a) => a.state !== 'terminated' && a.metadata.type === agentType,
    );
  }

  findByTag(tag: string): RegisteredAgent[] {
    return this.getAllAgents().filter(
      (a) =>
        a.state !== 'terminated' && a.metadata.tags?.includes(tag),
    );
  }

  getStaleAgents(timeoutMs: number): RegisteredAgent[] {
    const cutoff = new Date(Date.now() - timeoutMs);
    return this.getAllAgents().filter(
      (a) => a.state !== 'terminated' && a.lastHeartbeatAt < cutoff,
    );
  }

  getSummary() {
    const all = this.getAllAgents();
    const byState = all.reduce<Record<AgentLifecycleState, number>>(
      (acc, a) => {
        acc[a.state] = (acc[a.state] ?? 0) + 1;
        return acc;
      },
      { spawning: 0, running: 0, idle: 0, terminated: 0 },
    );

    return {
      total: all.length,
      byState,
      agents: all.map((a) => ({
        id: a.metadata.id,
        name: a.metadata.name,
        type: a.metadata.type,
        version: a.metadata.version,
        state: a.state,
        registeredAt: a.registeredAt,
        lastHeartbeatAt: a.lastHeartbeatAt,
        capabilities: a.metadata.capabilities.map((c: AgentCapability) => c.name),
        tags: a.metadata.tags ?? [],
      })),
    };
  }
}
