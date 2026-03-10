import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngineService } from '../src/engine/workflow-engine.service';
import { ActionExecutorService } from '../src/engine/action-executor.service';
import { WorkflowStateStore } from '../src/state/workflow-state.store';
import { CallAgentExecutor } from '../src/executors/call-agent.executor';
import { UpdateErpExecutor } from '../src/executors/update-erp.executor';
import { SendNotificationExecutor } from '../src/executors/send-notification.executor';
import type { WorkflowDefinition } from '../src/schema/workflow-definition.schema';
import { WORKFLOW_SCHEMA_VERSION } from '../src/schema/workflow-definition.schema';

function buildDefinition(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  const now = new Date().toISOString();
  return {
    id: 'wf-test-001',
    name: 'Test Workflow',
    enabled: true,
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    trigger: {
      type: 'erp.order.created',
      conditions: [{ field: 'payload.amount', operator: 'gt', value: 100 }],
    },
    actions: [
      {
        id: 'step-1',
        type: 'call_agent',
        label: 'Process with agent',
        config: { agentName: 'ops-agent', promptTemplate: 'Handle order {{payload.orderId}}' },
      },
      {
        id: 'step-2',
        type: 'send_notification',
        label: 'Notify customer',
        dependsOn: ['step-1'],
        config: {
          channel: 'email',
          recipient: 'test@example.com',
          subject: 'Order update',
          bodyTemplate: 'Your order has been processed.',
        },
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('WorkflowEngineService', () => {
  let engine: WorkflowEngineService;
  let stateStore: WorkflowStateStore;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        ActionExecutorService,
        WorkflowStateStore,
        CallAgentExecutor,
        UpdateErpExecutor,
        SendNotificationExecutor,
      ],
    }).compile();

    engine = module.get<WorkflowEngineService>(WorkflowEngineService);
    stateStore = module.get<WorkflowStateStore>(WorkflowStateStore);

    const executorService = module.get<ActionExecutorService>(ActionExecutorService);
    executorService.onModuleInit();
  });

  afterEach(async () => { await module.close(); });

  describe('registerDefinition / getDefinition / listDefinitions', () => {
    it('registers and retrieves a definition', () => {
      const def = buildDefinition();
      engine.registerDefinition(def);
      expect(engine.getDefinition('wf-test-001')).toMatchObject({ name: 'Test Workflow' });
    });

    it('throws NotFoundException for unknown id', () => {
      expect(() => engine.getDefinition('missing')).toThrow();
    });

    it('listDefinitions returns all registered definitions', () => {
      engine.registerDefinition(buildDefinition({ id: 'wf-1', name: 'WF1' }));
      engine.registerDefinition(buildDefinition({ id: 'wf-2', name: 'WF2' }));
      expect(engine.listDefinitions()).toHaveLength(2);
    });

    it('removeDefinition deletes and returns true', () => {
      engine.registerDefinition(buildDefinition());
      expect(engine.removeDefinition('wf-test-001')).toBe(true);
      expect(() => engine.getDefinition('wf-test-001')).toThrow();
    });

    it('removeDefinition returns false for non-existent id', () => {
      expect(engine.removeDefinition('ghost')).toBe(false);
    });
  });

  describe('matchingDefinitions', () => {
    it('returns matching definitions when conditions pass', () => {
      engine.registerDefinition(buildDefinition());
      const matched = engine.matchingDefinitions('erp.order.created', {
        payload: { orderId: 'ORD-1', amount: 999 },
      });
      expect(matched).toHaveLength(1);
    });

    it('returns empty array when condition fails', () => {
      engine.registerDefinition(buildDefinition());
      const matched = engine.matchingDefinitions('erp.order.created', {
        payload: { orderId: 'ORD-1', amount: 50 },
      });
      expect(matched).toHaveLength(0);
    });

    it('returns empty array for non-matching event type', () => {
      engine.registerDefinition(buildDefinition());
      const matched = engine.matchingDefinitions('erp.invoice.paid', {
        payload: { amount: 999 },
      });
      expect(matched).toHaveLength(0);
    });

    it('does not match disabled definitions', () => {
      engine.registerDefinition(buildDefinition({ enabled: false }));
      const matched = engine.matchingDefinitions('erp.order.created', {
        payload: { amount: 999 },
      });
      expect(matched).toHaveLength(0);
    });
  });

  describe('trigger', () => {
    it('creates an instance with status pending or beyond immediately', async () => {
      engine.registerDefinition(buildDefinition());
      const instance = await engine.trigger('wf-test-001', {
        payload: { orderId: 'ORD-5', amount: 200 },
      });

      expect(instance.instanceId).toBeDefined();
      expect(instance.workflowId).toBe('wf-test-001');
      expect(['pending', 'running', 'completed']).toContain(instance.status);
    });

    it('throws for disabled workflow', async () => {
      engine.registerDefinition(buildDefinition({ enabled: false }));
      await expect(engine.trigger('wf-test-001', {})).rejects.toThrow('disabled');
    });

    it('persists instance to the state store', async () => {
      engine.registerDefinition(buildDefinition());
      const instance = await engine.trigger('wf-test-001', { payload: { amount: 200 } });
      expect(stateStore.findById(instance.instanceId)).toBeDefined();
    });

    it('instance eventually reaches completed status', async () => {
      engine.registerDefinition(buildDefinition());
      const instance = await engine.trigger('wf-test-001', {
        payload: { orderId: 'ORD-X', amount: 300 },
      });
      await new Promise((r) => setTimeout(r, 100));
      const stored = stateStore.findById(instance.instanceId)!;
      expect(stored.status).toBe('completed');
    });
  });

  describe('handleEvent', () => {
    it('spawns instances for all matching workflows', async () => {
      engine.registerDefinition(buildDefinition({ id: 'wf-A' }));
      engine.registerDefinition(buildDefinition({ id: 'wf-B' }));
      const instances = await engine.handleEvent('erp.order.created', {
        payload: { orderId: 'ORD-99', amount: 500 },
      });
      expect(instances).toHaveLength(2);
    });

    it('returns empty array when no workflows match', async () => {
      engine.registerDefinition(buildDefinition());
      const instances = await engine.handleEvent('erp.invoice.paid', {});
      expect(instances).toHaveLength(0);
    });
  });

  describe('topological sort — cycle detection', () => {
    it('marks instance as failed when actions form a cycle', async () => {
      const cyclicDef = buildDefinition({
        id: 'cyclic-wf',
        actions: [
          {
            id: 'a',
            type: 'call_agent',
            label: 'A',
            dependsOn: ['b'],
            config: { agentName: 'agent', promptTemplate: 'x' },
          },
          {
            id: 'b',
            type: 'call_agent',
            label: 'B',
            dependsOn: ['a'],
            config: { agentName: 'agent', promptTemplate: 'y' },
          },
        ],
      });
      engine.registerDefinition(cyclicDef);

      const instance = await engine.trigger('cyclic-wf', {});
      // Give the async runInstance time to detect the cycle and update state
      await new Promise((r) => setTimeout(r, 200));

      const stored = stateStore.findById(instance.instanceId)!;
      expect(stored.status).toBe('failed');
      expect(stored.error).toContain('cycle');
    });
  });
});
