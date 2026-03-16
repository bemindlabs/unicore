/**
 * SpecialistRegistryService (specialist agent registry)
 *
 * A simple in-process registry that maps AgentType strings to ISpecialistAgent
 * instances.  On module init it registers all real specialist agent
 * implementations injected via NestJS DI.
 *
 * NOTE: This is distinct from registry/agent-registry.service.ts (AgentRegistryService)
 * which tracks WebSocket-connected agents.  This registry tracks NestJS-injectable
 * specialist agent classes used for intent routing and delegation.
 */

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type {
  AgentType,
  ISpecialistAgent,
} from "../interfaces/agent-base.interface";
import { CommsAgent } from "./comms/comms.agent";
import { FinanceAgent } from "./finance/finance.agent";
import { GrowthAgent } from "./growth/growth.agent";
import { OpsAgent } from "./ops/ops.agent";
import { ResearchAgent } from "./research/research.agent";
import { ErpAgent } from "./erp/erp.agent";
import { BuilderAgent } from "./builder/builder.agent";

@Injectable()
export class SpecialistRegistryService implements OnModuleInit {
  private readonly logger = new Logger(SpecialistRegistryService.name);
  private readonly agents = new Map<AgentType, ISpecialistAgent>();

  constructor(
    private readonly commsAgent: CommsAgent,
    private readonly financeAgent: FinanceAgent,
    private readonly growthAgent: GrowthAgent,
    private readonly opsAgent: OpsAgent,
    private readonly researchAgent: ResearchAgent,
    private readonly erpAgent: ErpAgent,
    private readonly builderAgent: BuilderAgent,
  ) {}

  onModuleInit(): void {
    const specialists: ISpecialistAgent[] = [
      this.commsAgent,
      this.financeAgent,
      this.growthAgent,
      this.opsAgent,
      this.researchAgent,
      this.erpAgent,
      this.builderAgent,
    ];

    for (const agent of specialists) {
      this.register(agent);
    }

    this.logger.log(
      `Specialist agents registered: [${this.registeredTypes().join(", ")}]`,
    );
  }

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
