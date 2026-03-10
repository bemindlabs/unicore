import type { WorkflowTopic } from '../constants/kafka.constants';

/** Mirrors the ErpEventEnvelope from the erp service. */
export interface EventEnvelopeDto<T = unknown> {
  eventId: string;
  occurredAt: string;
  type: WorkflowTopic;
  source: 'erp-service';
  schemaVersion: number;
  payload: T;
}
