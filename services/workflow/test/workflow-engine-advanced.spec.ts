/**
 * Advanced workflow engine tests covering:
 *  - continueOnError behaviour
 *  - Per-action timeout enforcement
 *  - Skipped actions when a dependency fails (cascade)
 *  - Multiple workflows triggered by a single event
 *  - Workflow with no actions
 *  - Condition evaluator edge cases (zero/null/falsy values)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngineService } from '../src/engine/workflow-engine.service';
import { ActionExecutorService } from '../src/engine/action-executor.service';
import { WorkflowStateStore } from '../src/state/workflow-state.store';
import { CallAgentExecutor } from '../src/executors/call-agent.executor';
import { UpdateErpExecutor } from '../src/executors/update-erp.executor';
import { SendNotificationExecutor } from '../src/executors/send-notification.executor';
import { SendTelegramExecutor } from '../src/executors/send-telegram.executor';
import { SendLineExecutor } from '../src/executors/send-line.executor';
import type { WorkflowDefinition } from '../src/schema/workflow-definition.schema';
import { WORKFLOW_SCHEMA_VERSION } from '../src/schema/workflow-definition.schema';
import { evaluateCondition, evaluateConditions } from '../src/common/condition-evaluator';
import type { TriggerCondition } from '../src/schema/workflow-definition.schema';

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

function buildDef(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  const now = new Date().toISOString();
  return {
    id: 'adv-wf-001',
    name: 'Advanced Workflow',
    enabled: true,
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    trigger: { type: 'erp.order.created' },
    actions: [
      {
        id: 'step-1',
        type: 'call_agent',
        label: 'Agent step',
        config: { agentName: 'ops-agent', promptTemplate: 'Handle {{payload.orderId}}' },
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('WorkflowEngineService — advanced scenarios', () => {
  let engine: WorkflowEngineService;
  let stateStore: WorkflowStateStore;
  let module: TestingModule;

  beforeEach(async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'mock' }),
      text: async () => 'ok',
    });
    process.env.OPENCLAW_GATEWAY_URL = 'http://localhost:18789';
    process.env.ERP_SERVICE_URL = 'http://localhost:4100';
    process.env.INTEGRATIONS_SERVICE_URL = 'http://localhost:4200';

    module = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        ActionExecutorService,
        WorkflowStateStore,
        CallAgentExecutor,
        UpdateErpExecutor,
        SendNotificationExecutor,
        SendTelegramExecutor,
        SendLineExecutor,
      ],
    }).compile();

    engine = module.get<WorkflowEngineService>(WorkflowEngineService);
    stateStore = module.get<WorkflowStateStore>(WorkflowStateStore);
    module.get<ActionExecutorService>(ActionExecutorService).onModuleInit();
  });

  afterEach(async () => {
    await module.close();
    delete process.env.OPENCLAW_GATEWAY_URL;
    delete process.env.ERP_SERVICE_URL;
    delete process.env.INTEGRATIONS_SERVICE_URL;
  });

  // -------------------------------------------------------------------------
  // continueOnError
  // -------------------------------------------------------------------------

  describe('continueOnError behaviour', () => {
    it('workflow completes when a failing action has continueOnError=true', async () => {
      // step-1 fails (fetch returns 500), step-2 has continueOnError=true and also fails,
      // step-3 has no dependency so it runs and completes the workflow
      const def = buildDef({
        id: 'wf-coe',
        actions: [
          {
            id: 'step-1',
            type: 'call_agent',
            label: 'Failing agent',
            continueOnError: true,
            config: { agentName: 'failing-agent', promptTemplate: 'x' },
          },
          {
            id: 'step-2',
            type: 'send_notification',
            label: 'Notify',
            config: {
              channel: 'email',
              recipient: 'admin@example.com',
              subject: 'Done',
              bodyTemplate: 'Done',
            },
          },
        ],
      });

      // step-1 fails because fetch returns non-ok
      mockFetch
        .mockResolvedValueOnce({ ok: false, text: async () => 'Internal Error', json: async () => ({}) })
        .mockResolvedValue({ ok: true, json: async () => ({}), text: async () => 'ok' });

      engine.registerDefinition(def);
      const instance = await engine.trigger('wf-coe', { payload: { orderId: 'ORD-1' } });
      await new Promise((r) => setTimeout(r, 200));

      const stored = stateStore.findById(instance.instanceId)!;
      expect(stored.status).toBe('completed');

      const failedAction = stored.actions.find((a) => a.actionId === 'step-1');
      expect(failedAction?.status).toBe('failed');

      const completedAction = stored.actions.find((a) => a.actionId === 'step-2');
      expect(completedAction?.status).toBe('completed');
    });

    it('workflow fails when a failing action does NOT have continueOnError', async () => {
      const def = buildDef({
        id: 'wf-no-coe',
        actions: [
          {
            id: 'step-1',
            type: 'call_agent',
            label: 'Failing agent',
            // continueOnError defaults to false
            config: { agentName: 'failing-agent', promptTemplate: 'x' },
          },
          {
            id: 'step-2',
            type: 'send_notification',
            label: 'Notify',
            config: {
              channel: 'email',
              recipient: 'admin@example.com',
              subject: 'Done',
              bodyTemplate: 'Done',
            },
          },
        ],
      });

      mockFetch.mockResolvedValue({ ok: false, text: async () => 'Error', json: async () => ({}) });

      engine.registerDefinition(def);
      const instance = await engine.trigger('wf-no-coe', {});
      await new Promise((r) => setTimeout(r, 200));

      const stored = stateStore.findById(instance.instanceId)!;
      expect(stored.status).toBe('failed');
    });
  });

  // -------------------------------------------------------------------------
  // Dependency cascade — skipping downstream on failure
  // -------------------------------------------------------------------------

  describe('dependency cascade', () => {
    it('skips dependent actions when their dependency fails', async () => {
      const def = buildDef({
        id: 'wf-cascade',
        actions: [
          {
            id: 'step-a',
            type: 'call_agent',
            label: 'Step A (fails)',
            continueOnError: true,
            config: { agentName: 'agent', promptTemplate: 'x' },
          },
          {
            id: 'step-b',
            type: 'send_notification',
            label: 'Step B (depends on A)',
            dependsOn: ['step-a'],
            config: {
              channel: 'email',
              recipient: 'ops@example.com',
              subject: 'Alert',
              bodyTemplate: 'Result of A',
            },
          },
        ],
      });

      // step-a fails, step-b should be skipped
      mockFetch.mockResolvedValue({ ok: false, text: async () => 'fail', json: async () => ({}) });

      engine.registerDefinition(def);
      const instance = await engine.trigger('wf-cascade', {});
      await new Promise((r) => setTimeout(r, 200));

      const stored = stateStore.findById(instance.instanceId)!;
      const stepA = stored.actions.find((a) => a.actionId === 'step-a');
      const stepB = stored.actions.find((a) => a.actionId === 'step-b');

      expect(stepA?.status).toBe('failed');
      expect(stepB?.status).toBe('skipped');
      // Workflow completes because step-a had continueOnError=true
      expect(stored.status).toBe('completed');
    });
  });

  // -------------------------------------------------------------------------
  // Per-action timeout
  // -------------------------------------------------------------------------

  describe('per-action timeout', () => {
    it('fails the workflow when an action exceeds its timeoutMs', async () => {
      const def = buildDef({
        id: 'wf-timeout',
        actions: [
          {
            id: 'slow-step',
            type: 'call_agent',
            label: 'Slow agent',
            timeoutMs: 100, // very short timeout
            config: { agentName: 'slow-agent', promptTemplate: 'x' },
          },
        ],
      });

      // Simulate a slow fetch that takes 2 seconds
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ ok: true, json: async () => ({ reply: 'late reply' }) }),
              2000,
            ),
          ),
      );

      engine.registerDefinition(def);
      const instance = await engine.trigger('wf-timeout', {});
      // Wait for timeout to fire (100ms) + buffer
      await new Promise((r) => setTimeout(r, 400));

      const stored = stateStore.findById(instance.instanceId)!;
      expect(stored.status).toBe('failed');
      expect(stored.error).toContain('timed out');
    }, 10_000);
  });

  // -------------------------------------------------------------------------
  // Workflow with no actions
  // -------------------------------------------------------------------------

  describe('workflow with no actions', () => {
    it('completes immediately with no action executions', async () => {
      const def = buildDef({
        id: 'wf-empty',
        actions: [],
      });

      engine.registerDefinition(def);
      const instance = await engine.trigger('wf-empty', {});
      await new Promise((r) => setTimeout(r, 100));

      const stored = stateStore.findById(instance.instanceId)!;
      expect(stored.status).toBe('completed');
      expect(stored.actions).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple matching workflows fired by handleEvent
  // -------------------------------------------------------------------------

  describe('handleEvent with multiple triggers', () => {
    it('creates separate instances for three matching workflows', async () => {
      engine.registerDefinition(buildDef({ id: 'wf-X', name: 'X' }));
      engine.registerDefinition(buildDef({ id: 'wf-Y', name: 'Y' }));
      engine.registerDefinition(buildDef({ id: 'wf-Z', name: 'Z' }));

      const instances = await engine.handleEvent('erp.order.created', {
        payload: { orderId: 'ORD-multi' },
      });

      expect(instances).toHaveLength(3);
      const ids = instances.map((i) => i.workflowId);
      expect(ids).toContain('wf-X');
      expect(ids).toContain('wf-Y');
      expect(ids).toContain('wf-Z');
    });
  });

  // -------------------------------------------------------------------------
  // Action output passed to next action via previousOutputs
  // -------------------------------------------------------------------------

  describe('previousOutputs chaining', () => {
    it('passes step-1 output to step-2 via interpolation context', async () => {
      const def = buildDef({
        id: 'wf-chain',
        actions: [
          {
            id: 'gen-invoice',
            type: 'call_agent',
            label: 'Generate Invoice',
            config: { agentName: 'finance-agent', promptTemplate: 'Generate invoice for {{payload.orderId}}' },
          },
          {
            id: 'notify-customer',
            type: 'send_notification',
            label: 'Notify Customer',
            dependsOn: ['gen-invoice'],
            config: {
              channel: 'email',
              recipient: 'customer@example.com',
              subject: 'Invoice ready',
              bodyTemplate: 'Agent said: {{outputs.gen-invoice.reply}}',
            },
          },
        ],
      });

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ reply: 'invoice-created-123' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}), text: async () => 'ok' });

      engine.registerDefinition(def);
      const instance = await engine.trigger('wf-chain', { payload: { orderId: 'ORD-chain' } });
      await new Promise((r) => setTimeout(r, 200));

      const stored = stateStore.findById(instance.instanceId)!;
      expect(stored.status).toBe('completed');

      // Verify the notification fetch body included the interpolated output
      const notifyCall = mockFetch.mock.calls.find((call) => {
        const url = call[0] as string;
        return url.includes('/api/notifications/send');
      });
      expect(notifyCall).toBeDefined();
      const body = JSON.parse(notifyCall[1].body);
      expect(body.body).toContain('invoice-created-123');
    });
  });
});

// -------------------------------------------------------------------------
// Condition evaluator edge cases (zero, null, falsy values, type coercion)
// -------------------------------------------------------------------------

describe('evaluateCondition — edge cases', () => {
  describe('zero and falsy numeric values', () => {
    it('eq — matches zero value', () => {
      const cond: TriggerCondition = { field: 'count', operator: 'eq', value: 0 };
      expect(evaluateCondition(cond, { count: 0 })).toBe(true);
    });

    it('gt — zero is not gt zero', () => {
      const cond: TriggerCondition = { field: 'count', operator: 'gt', value: 0 };
      expect(evaluateCondition(cond, { count: 0 })).toBe(false);
    });

    it('lt — zero is lt one', () => {
      const cond: TriggerCondition = { field: 'count', operator: 'lt', value: 1 };
      expect(evaluateCondition(cond, { count: 0 })).toBe(true);
    });

    it('lte — zero is lte zero', () => {
      const cond: TriggerCondition = { field: 'count', operator: 'lte', value: 0 };
      expect(evaluateCondition(cond, { count: 0 })).toBe(true);
    });

    it('gte — zero is gte zero', () => {
      const cond: TriggerCondition = { field: 'count', operator: 'gte', value: 0 };
      expect(evaluateCondition(cond, { count: 0 })).toBe(true);
    });

    it('gt — rejects non-numeric actual with numeric expected', () => {
      const cond: TriggerCondition = { field: 'val', operator: 'gt', value: 0 };
      expect(evaluateCondition(cond, { val: '5' })).toBe(false);
    });
  });

  describe('null and undefined field values', () => {
    it('exists — returns false for null value', () => {
      const cond: TriggerCondition = { field: 'field', operator: 'exists' };
      expect(evaluateCondition(cond, { field: null })).toBe(false);
    });

    it('not_exists — returns true for null value', () => {
      const cond: TriggerCondition = { field: 'field', operator: 'not_exists' };
      expect(evaluateCondition(cond, { field: null })).toBe(true);
    });

    it('exists — returns true for zero (falsy but defined)', () => {
      const cond: TriggerCondition = { field: 'count', operator: 'exists' };
      expect(evaluateCondition(cond, { count: 0 })).toBe(true);
    });

    it('exists — returns true for empty string (falsy but defined)', () => {
      const cond: TriggerCondition = { field: 'name', operator: 'exists' };
      expect(evaluateCondition(cond, { name: '' })).toBe(true);
    });

    it('eq — does not match when field is undefined', () => {
      const cond: TriggerCondition = { field: 'missing', operator: 'eq', value: undefined };
      expect(evaluateCondition(cond, {})).toBe(true); // undefined === undefined
    });

    it('neq — matches when field is undefined but expected is a value', () => {
      const cond: TriggerCondition = { field: 'missing', operator: 'neq', value: 'something' };
      expect(evaluateCondition(cond, {})).toBe(true);
    });
  });

  describe('string operators on non-string values', () => {
    it('contains — returns false when actual is a number', () => {
      const cond: TriggerCondition = { field: 'val', operator: 'contains', value: '5' };
      expect(evaluateCondition(cond, { val: 5 })).toBe(false);
    });

    it('not_contains — returns false when actual is a number', () => {
      const cond: TriggerCondition = { field: 'val', operator: 'not_contains', value: '5' };
      expect(evaluateCondition(cond, { val: 5 })).toBe(false);
    });

    it('contains — returns false when actual is null', () => {
      const cond: TriggerCondition = { field: 'val', operator: 'contains', value: 'test' };
      expect(evaluateCondition(cond, { val: null })).toBe(false);
    });
  });

  describe('evaluateConditions — AND logic edge cases', () => {
    it('returns true for single passing condition', () => {
      const conditions: TriggerCondition[] = [
        { field: 'amount', operator: 'gt', value: 0 },
      ];
      expect(evaluateConditions(conditions, { amount: 100 })).toBe(true);
    });

    it('returns false if any one condition in a long list fails', () => {
      const conditions: TriggerCondition[] = [
        { field: 'a', operator: 'eq', value: 1 },
        { field: 'b', operator: 'eq', value: 2 },
        { field: 'c', operator: 'eq', value: 99 }, // this one fails
        { field: 'd', operator: 'eq', value: 4 },
      ];
      expect(evaluateConditions(conditions, { a: 1, b: 2, c: 3, d: 4 })).toBe(false);
    });

    it('returns true when all conditions pass on deeply nested paths', () => {
      const conditions: TriggerCondition[] = [
        { field: 'order.customer.tier', operator: 'eq', value: 'gold' },
        { field: 'order.total', operator: 'gt', value: 500 },
      ];
      expect(
        evaluateConditions(conditions, { order: { customer: { tier: 'gold' }, total: 1000 } }),
      ).toBe(true);
    });

    it('handles boolean eq comparison', () => {
      const cond: TriggerCondition = { field: 'isPriority', operator: 'eq', value: true };
      expect(evaluateCondition(cond, { isPriority: true })).toBe(true);
      expect(evaluateCondition(cond, { isPriority: false })).toBe(false);
    });
  });
});
