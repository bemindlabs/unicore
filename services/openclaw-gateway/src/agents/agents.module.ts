/**
 * AgentsModule — registers all 7 specialist agents and exports them
 * for use by the Router and the gateway's dispatch layer.
 */

import { Module } from '@nestjs/common';
import { CommsAgent } from './comms/comms.agent';
import { FinanceAgent } from './finance/finance.agent';
import { GrowthAgent } from './growth/growth.agent';
import { OpsAgent } from './ops/ops.agent';
import { ResearchAgent } from './research/research.agent';
import { ErpAgent } from './erp/erp.agent';
import { BuilderAgent } from './builder/builder.agent';

export const SPECIALIST_AGENTS = [
  CommsAgent,
  FinanceAgent,
  GrowthAgent,
  OpsAgent,
  ResearchAgent,
  ErpAgent,
  BuilderAgent,
];

@Module({
  providers: [...SPECIALIST_AGENTS],
  exports: [...SPECIALIST_AGENTS],
})
export class AgentsModule {}
