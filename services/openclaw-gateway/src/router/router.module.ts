import { Module } from '@nestjs/common';
import { RouterAgent } from './router.agent';
import { IntentClassifierService } from './intent-classifier.service';
import { DelegationService } from './delegation.service';
import { LLM_CLIENT } from '../common/llm-client.interface';
import { MockLlmClient } from '../common/mock-llm-client';
import { AgentsModule } from '../agents/agents.module';

/**
 * RouterModule
 *
 * Encapsulates all components required for intent classification and task
 * delegation:
 *
 *   - RouterAgent            : Always-on orchestrator (the entry point)
 *   - IntentClassifierService: LLM-powered intent classification
 *   - DelegationService      : Maps intents to specialist agent invocations
 *   - LLM_CLIENT (token)     : LLM provider — MockLlmClient in dev/test,
 *                              swap to a real adapter via useClass/useFactory
 *   - AgentsModule           : Provides and exports all 7 specialist agents
 *                              (UNC-29: CommsAgent, FinanceAgent, GrowthAgent,
 *                               OpsAgent, ResearchAgent, ErpAgent, BuilderAgent)
 */
@Module({
  imports: [AgentsModule],
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
  ],
  exports: [RouterAgent, DelegationService, AgentsModule],
})
export class RouterModule {}
