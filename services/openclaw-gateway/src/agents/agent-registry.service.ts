/**
 * AgentRegistryService (specialist agent registry)
 *
 * A simple in-process registry that maps AgentType strings to ISpecialistAgent
 * instances.  The RouterAgent registers all specialist stubs on startup; real
 * agent implementations replace these as each specialist story is completed.
 *
 * NOTE: This is distinct from registry/agent-registry.service.ts which tracks
 * WebSocket-connected agents.  This registry tracks NestJS-injectable
 * specialist agent classes.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { AgentType, ISpecialistAgent } from '../interfaces/agent-base.interface';

@Injectable()
export class AgentRegistryService {
  private readonly logger = new Logger(AgentRegistryService.name);
  private readonly agents = new Map<AgentType, ISpecialistAgent>();

  register(agent: ISpecialistAgent): void {
    this.agents.set(agent.agentType, agent);
    this.logger.log(`Specialist agent registered: ${agent.agentType}`);
  }

  resolve(type: AgentType): ISpecialistAgent | undefined {
    return this.agents.get(type);
  }

  isAvailable(type: AgentType): boolean {
    const agent = this.agents.get(type);
    return agent !== undefined && agent.isAvailable();
  }

  registeredTypes(): AgentType[] {
    return Array.from(this.agents.keys());
  }
}
