import { Module } from '@nestjs/common';
import { RouterAgent } from './router.agent';
import { IntentClassifierService } from './intent-classifier.service';
import { DelegationService } from './delegation.service';
import { LLM_CLIENT } from '../common/llm-client.interface';
import { MockLlmClient } from '../common/mock-llm-client';
import { CommsAgent } from '../agents/comms/comms.agent';
import { FinanceAgent } from '../agents/finance/finance.agent';
import { GrowthAgent } from '../agents/growth/growth.agent';
import { OpsAgent } from '../agents/ops/ops.agent';
import { ResearchAgent } from '../agents/research/research.agent';
import { ErpAgent } from '../agents/erp/erp.agent';
import { BuilderAgent } from '../agents/builder/builder.agent';

/**
 * RouterModule
 *
 * Encapsulates all components required for intent classification and task
 * delegation:
 *
 *   - RouterAgent          : Always-on orchestrator (the entry point)
 *   - IntentClassifierService: LLM-powered intent classification
 *   - DelegationService    : Maps intents to specialist agent invocations
 *   - LLM_CLIENT (token)   : LLM provider — MockLlmClient in dev/test,
 *                            swap to a real adapter via useClass/useFactory
 *   - All 7 specialist agents (CommsAgent through BuilderAgent)
 */
@Module({
  providers: [
    // LLM client — override this token in production with a real provider
    {
      provide: LLM_CLIENT,
      useClass: MockLlmClient,
    },

    // Router infrastructure
    IntentClassifierService,
    DelegationService,
    RouterAgent,

    // Specialist agents
    CommsAgent,
    FinanceAgent,
    GrowthAgent,
    OpsAgent,
    ResearchAgent,
    ErpAgent,
    BuilderAgent,
  ],
  exports: [RouterAgent, DelegationService],
})
export class RouterModule {}
