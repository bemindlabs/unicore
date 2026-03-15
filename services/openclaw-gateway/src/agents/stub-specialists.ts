/**
 * Specialist agent re-exports.
 *
 * Previously contained lightweight stub implementations.  All agents now have
 * real implementations; this file re-exports them so that any import path using
 * stub-specialists continues to resolve to the correct classes.
 */

export { CommsAgent as CommsStubAgent } from "./comms/comms.agent";
export { FinanceAgent as FinanceStubAgent } from "./finance/finance.agent";
export { GrowthAgent as GrowthStubAgent } from "./growth/growth.agent";
export { OpsAgent as OpsStubAgent } from "./ops/ops.agent";
export { ResearchAgent as ResearchStubAgent } from "./research/research.agent";
export { ErpAgent as ErpStubAgent } from "./erp/erp.agent";
export { BuilderAgent as BuilderStubAgent } from "./builder/builder.agent";
