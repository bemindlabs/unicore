import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkflowController } from '../src/workflow/workflow.controller';
import { WorkflowService } from '../src/workflow/workflow.service';
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
        config: { agentName: 'ops-agent', promptTemplate: 'Process {{payload.orderId}}' },
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

describe('WorkflowController', () => {
  let controller: WorkflowController;
  let workflowService: jest.Mocked<WorkflowService>;
  let module: TestingModule;

  beforeEach(async () => {
    const mockService: jest.Mocked<Partial<WorkflowService>> = {
      registerDefinition: jest.fn(),
      listDefinitions: jest.fn(),
      getDefinition: jest.fn(),
      removeDefinition: jest.fn(),
      trigger: jest.fn(),
      handleEvent: jest.fn(),
      listInstances: jest.fn(),
      getInstance: jest.fn(),
      listInstancesByWorkflow: jest.fn(),
    };

    module = await Test.createTestingModule({
      controllers: [WorkflowController],
      providers: [
        { provide: WorkflowService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<WorkflowController>(WorkflowController);
    workflowService = module.get(WorkflowService);
  });

  afterEach(async () => {
    await module.close();
  });

  // -------------------------------------------------------------------------
  // POST /definitions — registerDefinition
  // -------------------------------------------------------------------------

  describe('registerDefinition', () => {
    it('delegates to WorkflowService and returns the definition', () => {
      const def = makeDefinition();
      workflowService.registerDefinition.mockReturnValue(def);
      const result = controller.registerDefinition(def as any);
      expect(workflowService.registerDefinition).toHaveBeenCalledWith(def);
      expect(result).toBe(def);
    });
  });

  // -------------------------------------------------------------------------
  // GET /definitions — listDefinitions
  // -------------------------------------------------------------------------

  describe('listDefinitions', () => {
    it('returns all workflow definitions', () => {
      const defs = [makeDefinition(), makeDefinition({ id: 'wf-002' })];
      workflowService.listDefinitions.mockReturnValue(defs);
      const result = controller.listDefinitions();
      expect(result).toBe(defs);
    });

    it('returns empty array when no definitions exist', () => {
      workflowService.listDefinitions.mockReturnValue([]);
      expect(controller.listDefinitions()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // GET /definitions/:id — getDefinition
  // -------------------------------------------------------------------------

  describe('getDefinition', () => {
    it('returns the definition for the given ID', () => {
      const def = makeDefinition();
      workflowService.getDefinition.mockReturnValue(def);
      const result = controller.getDefinition('wf-001');
      expect(workflowService.getDefinition).toHaveBeenCalledWith('wf-001');
      expect(result).toBe(def);
    });

    it('propagates NotFoundException from service', () => {
      workflowService.getDefinition.mockImplementation(() => {
        throw new NotFoundException('not found');
      });
      expect(() => controller.getDefinition('ghost')).toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /definitions/:id — removeDefinition
  // -------------------------------------------------------------------------

  describe('removeDefinition', () => {
    it('returns { deleted: true } when removed successfully', () => {
      workflowService.removeDefinition.mockReturnValue({ deleted: true });
      const result = controller.removeDefinition('wf-001');
      expect(workflowService.removeDefinition).toHaveBeenCalledWith('wf-001');
      expect(result).toEqual({ deleted: true });
    });

    it('returns { deleted: false } when definition not found', () => {
      workflowService.removeDefinition.mockReturnValue({ deleted: false });
      expect(controller.removeDefinition('ghost')).toEqual({ deleted: false });
    });
  });

  // -------------------------------------------------------------------------
  // POST /trigger — trigger
  // -------------------------------------------------------------------------

  describe('trigger', () => {
    it('triggers a workflow with the given payload', async () => {
      const inst = makeInstance();
      workflowService.trigger.mockResolvedValue(inst);
      const dto = { workflowId: 'wf-001', payload: { orderId: 'ORD-1' } };
      const result = await controller.trigger(dto as any);
      expect(workflowService.trigger).toHaveBeenCalledWith('wf-001', { orderId: 'ORD-1' });
      expect(result).toBe(inst);
    });

    it('passes empty object when payload is undefined', async () => {
      const inst = makeInstance();
      workflowService.trigger.mockResolvedValue(inst);
      await controller.trigger({ workflowId: 'wf-001' } as any);
      expect(workflowService.trigger).toHaveBeenCalledWith('wf-001', {});
    });
  });

  // -------------------------------------------------------------------------
  // POST /events — handleEvent
  // -------------------------------------------------------------------------

  describe('handleEvent', () => {
    it('handles an event and returns triggered instances', async () => {
      const instances = [makeInstance()];
      workflowService.handleEvent.mockResolvedValue(instances);
      const dto = { eventType: 'erp.order.created', payload: { amount: 200 } };
      const result = await controller.handleEvent(dto as any);
      expect(workflowService.handleEvent).toHaveBeenCalledWith('erp.order.created', { amount: 200 });
      expect(result).toBe(instances);
    });

    it('passes empty object when payload is undefined', async () => {
      workflowService.handleEvent.mockResolvedValue([]);
      await controller.handleEvent({ eventType: 'erp.order.created' } as any);
      expect(workflowService.handleEvent).toHaveBeenCalledWith('erp.order.created', {});
    });

    it('returns empty array when no workflows match', async () => {
      workflowService.handleEvent.mockResolvedValue([]);
      const result = await controller.handleEvent({ eventType: 'unknown', payload: {} } as any);
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // GET /instances — listInstances
  // -------------------------------------------------------------------------

  describe('listInstances', () => {
    it('returns all instances', () => {
      const instances = [makeInstance(), makeInstance({ instanceId: 'inst-002' })];
      workflowService.listInstances.mockReturnValue(instances);
      const result = controller.listInstances();
      expect(result).toBe(instances);
    });

    it('returns empty array when no instances exist', () => {
      workflowService.listInstances.mockReturnValue([]);
      expect(controller.listInstances()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // GET /instances/:instanceId — getInstance
  // -------------------------------------------------------------------------

  describe('getInstance', () => {
    it('returns the instance for a given ID', () => {
      const inst = makeInstance();
      workflowService.getInstance.mockReturnValue(inst);
      const result = controller.getInstance('inst-001');
      expect(workflowService.getInstance).toHaveBeenCalledWith('inst-001');
      expect(result).toBe(inst);
    });

    it('propagates NotFoundException when instance not found', () => {
      workflowService.getInstance.mockImplementation(() => {
        throw new NotFoundException('not found');
      });
      expect(() => controller.getInstance('ghost')).toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // GET /definitions/:id/instances — listInstancesByWorkflow
  // -------------------------------------------------------------------------

  describe('listInstancesByWorkflow', () => {
    it('returns instances for the given workflow ID', () => {
      const instances = [makeInstance(), makeInstance({ instanceId: 'inst-002' })];
      workflowService.listInstancesByWorkflow.mockReturnValue(instances);
      const result = controller.listInstancesByWorkflow('wf-001');
      expect(workflowService.listInstancesByWorkflow).toHaveBeenCalledWith('wf-001');
      expect(result).toBe(instances);
    });

    it('returns empty array when workflow has no instances', () => {
      workflowService.listInstancesByWorkflow.mockReturnValue([]);
      expect(controller.listInstancesByWorkflow('wf-ghost')).toEqual([]);
    });
  });
});
