import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkflowService } from '../src/workflow/workflow.service';
import { WorkflowEngineService } from '../src/engine/workflow-engine.service';
import { WorkflowStateStore } from '../src/state/workflow-state.store';
import type { WorkflowDefinition } from '../src/schema/workflow-definition.schema';
import { WORKFLOW_SCHEMA_VERSION } from '../src/schema/workflow-definition.schema';
import type { WorkflowInstance } from '../src/state/workflow-instance';

function makeDefinition(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  const now = new Date().toISOString();
  return {
    id: 'wf-001',
    name: 'Test Workflow',
    enabled: true,
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    trigger: { type: 'erp.order.created', conditions: [] },
    actions: [
      {
        id: 'step-1',
        type: 'call_agent',
        label: 'Call agent',
        config: { agentName: 'ops-agent', promptTemplate: 'Process order {{payload.orderId}}' },
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeInstance(overrides: Partial<WorkflowInstance> = {}): WorkflowInstance {
  const now = new Date().toISOString();
  return {
    instanceId: 'inst-001',
    workflowId: 'wf-001',
    workflowName: 'Test Workflow',
    status: 'completed',
    triggerPayload: {},
    actions: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('WorkflowService', () => {
  let service: WorkflowService;
  let engine: jest.Mocked<WorkflowEngineService>;
  let stateStore: jest.Mocked<WorkflowStateStore>;
  let module: TestingModule;

  beforeEach(async () => {
    const mockEngine: jest.Mocked<Partial<WorkflowEngineService>> = {
      registerDefinition: jest.fn(),
      listDefinitions: jest.fn(),
      getDefinition: jest.fn(),
      removeDefinition: jest.fn(),
      trigger: jest.fn(),
      handleEvent: jest.fn(),
    };

    const mockStore: jest.Mocked<Partial<WorkflowStateStore>> = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findByWorkflowId: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: WorkflowEngineService, useValue: mockEngine },
        { provide: WorkflowStateStore, useValue: mockStore },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
    engine = module.get(WorkflowEngineService);
    stateStore = module.get(WorkflowStateStore);
  });

  afterEach(async () => {
    await module.close();
  });

  // -------------------------------------------------------------------------
  // registerDefinition
  // -------------------------------------------------------------------------

  describe('registerDefinition', () => {
    it('delegates to engine and returns the definition', () => {
      const def = makeDefinition();
      const result = service.registerDefinition(def);
      expect(engine.registerDefinition).toHaveBeenCalledWith(def);
      expect(result).toBe(def);
    });
  });

  // -------------------------------------------------------------------------
  // listDefinitions
  // -------------------------------------------------------------------------

  describe('listDefinitions', () => {
    it('returns all definitions from engine', () => {
      const defs = [makeDefinition(), makeDefinition({ id: 'wf-002' })];
      engine.listDefinitions.mockReturnValue(defs);
      expect(service.listDefinitions()).toEqual(defs);
    });

    it('returns empty array when no definitions registered', () => {
      engine.listDefinitions.mockReturnValue([]);
      expect(service.listDefinitions()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getDefinition
  // -------------------------------------------------------------------------

  describe('getDefinition', () => {
    it('returns the definition for the given ID', () => {
      const def = makeDefinition();
      engine.getDefinition.mockReturnValue(def);
      const result = service.getDefinition('wf-001');
      expect(engine.getDefinition).toHaveBeenCalledWith('wf-001');
      expect(result).toBe(def);
    });

    it('propagates NotFoundException from engine', () => {
      engine.getDefinition.mockImplementation(() => {
        throw new NotFoundException('not found');
      });
      expect(() => service.getDefinition('ghost')).toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // removeDefinition
  // -------------------------------------------------------------------------

  describe('removeDefinition', () => {
    it('returns { deleted: true } when engine removes successfully', () => {
      engine.removeDefinition.mockReturnValue(true);
      expect(service.removeDefinition('wf-001')).toEqual({ deleted: true });
    });

    it('returns { deleted: false } when definition does not exist', () => {
      engine.removeDefinition.mockReturnValue(false);
      expect(service.removeDefinition('ghost')).toEqual({ deleted: false });
    });
  });

  // -------------------------------------------------------------------------
  // trigger
  // -------------------------------------------------------------------------

  describe('trigger', () => {
    it('delegates to engine with provided payload', async () => {
      const inst = makeInstance();
      engine.trigger.mockResolvedValue(inst);
      const payload = { orderId: 'ORD-1' };
      const result = await service.trigger('wf-001', payload);
      expect(engine.trigger).toHaveBeenCalledWith('wf-001', payload);
      expect(result).toBe(inst);
    });

    it('passes empty object when payload is undefined', async () => {
      const inst = makeInstance();
      engine.trigger.mockResolvedValue(inst);
      await service.trigger('wf-001', undefined);
      expect(engine.trigger).toHaveBeenCalledWith('wf-001', {});
    });

    it('passes empty object when payload is null', async () => {
      const inst = makeInstance();
      engine.trigger.mockResolvedValue(inst);
      await service.trigger('wf-001', null);
      expect(engine.trigger).toHaveBeenCalledWith('wf-001', {});
    });
  });

  // -------------------------------------------------------------------------
  // handleEvent
  // -------------------------------------------------------------------------

  describe('handleEvent', () => {
    it('delegates to engine with event type and payload', async () => {
      const instances = [makeInstance()];
      engine.handleEvent.mockResolvedValue(instances);
      const payload = { amount: 200 };
      const result = await service.handleEvent('erp.order.created', payload);
      expect(engine.handleEvent).toHaveBeenCalledWith('erp.order.created', payload);
      expect(result).toBe(instances);
    });

    it('passes empty object when payload is undefined', async () => {
      engine.handleEvent.mockResolvedValue([]);
      await service.handleEvent('erp.order.created', undefined);
      expect(engine.handleEvent).toHaveBeenCalledWith('erp.order.created', {});
    });

    it('returns empty array when no workflows match', async () => {
      engine.handleEvent.mockResolvedValue([]);
      const result = await service.handleEvent('unknown.event', {});
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getInstance
  // -------------------------------------------------------------------------

  describe('getInstance', () => {
    it('returns the instance when found', () => {
      const inst = makeInstance();
      stateStore.findById.mockReturnValue(inst);
      const result = service.getInstance('inst-001');
      expect(stateStore.findById).toHaveBeenCalledWith('inst-001');
      expect(result).toBe(inst);
    });

    it('throws NotFoundException when instance not found', () => {
      stateStore.findById.mockReturnValue(undefined);
      expect(() => service.getInstance('ghost-inst')).toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // listInstances
  // -------------------------------------------------------------------------

  describe('listInstances', () => {
    it('returns all instances from state store', () => {
      const instances = [makeInstance(), makeInstance({ instanceId: 'inst-002' })];
      stateStore.findAll.mockReturnValue(instances);
      expect(service.listInstances()).toBe(instances);
    });

    it('returns empty array when no instances exist', () => {
      stateStore.findAll.mockReturnValue([]);
      expect(service.listInstances()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // listInstancesByWorkflow
  // -------------------------------------------------------------------------

  describe('listInstancesByWorkflow', () => {
    it('returns instances filtered by workflow ID', () => {
      const instances = [makeInstance(), makeInstance({ instanceId: 'inst-002' })];
      stateStore.findByWorkflowId.mockReturnValue(instances);
      const result = service.listInstancesByWorkflow('wf-001');
      expect(stateStore.findByWorkflowId).toHaveBeenCalledWith('wf-001');
      expect(result).toBe(instances);
    });

    it('returns empty array when no instances match the workflow', () => {
      stateStore.findByWorkflowId.mockReturnValue([]);
      expect(service.listInstancesByWorkflow('wf-ghost')).toEqual([]);
    });
  });
});
