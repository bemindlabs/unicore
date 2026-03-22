import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkflowTemplatesController } from '../src/module/workflow-templates.controller';
import { TemplateRegistryService } from '../src/registry/template-registry.service';
import type { WorkflowDefinition } from '../src/schema/workflow-definition.schema';
import { WORKFLOW_SCHEMA_VERSION } from '../src/schema/workflow-definition.schema';

function makeDefinition(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  const now = new Date().toISOString();
  return {
    id: 'tpl-001',
    name: 'Test Template',
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

describe('WorkflowTemplatesController', () => {
  let controller: WorkflowTemplatesController;
  let registry: jest.Mocked<TemplateRegistryService>;
  let module: TestingModule;

  beforeEach(async () => {
    const mockRegistry: jest.Mocked<Partial<TemplateRegistryService>> = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByTrigger: jest.fn(),
      validate: jest.fn(),
    };

    module = await Test.createTestingModule({
      controllers: [WorkflowTemplatesController],
      providers: [
        { provide: TemplateRegistryService, useValue: mockRegistry },
      ],
    }).compile();

    controller = module.get<WorkflowTemplatesController>(WorkflowTemplatesController);
    registry = module.get(TemplateRegistryService);
  });

  afterEach(async () => {
    await module.close();
  });

  // -------------------------------------------------------------------------
  // GET / findAll
  // -------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns enabled templates by default (enabledOnly=undefined)', () => {
      const defs = [makeDefinition(), makeDefinition({ id: 'tpl-002' })];
      registry.findAll.mockReturnValue(defs);
      const result = controller.findAll(undefined);
      expect(registry.findAll).toHaveBeenCalledWith(true);
      expect(result).toEqual({ success: true, total: 2, data: defs });
    });

    it('returns enabled templates when enabledOnly="true"', () => {
      const defs = [makeDefinition()];
      registry.findAll.mockReturnValue(defs);
      const result = controller.findAll('true');
      expect(registry.findAll).toHaveBeenCalledWith(true);
      expect(result.total).toBe(1);
    });

    it('returns all templates when enabledOnly="false"', () => {
      const defs = [makeDefinition(), makeDefinition({ id: 'tpl-disabled', enabled: false })];
      registry.findAll.mockReturnValue(defs);
      const result = controller.findAll('false');
      expect(registry.findAll).toHaveBeenCalledWith(false);
      expect(result.total).toBe(2);
    });

    it('returns empty list when no templates registered', () => {
      registry.findAll.mockReturnValue([]);
      const result = controller.findAll(undefined);
      expect(result).toEqual({ success: true, total: 0, data: [] });
    });
  });

  // -------------------------------------------------------------------------
  // GET /trigger/:type — findByTrigger
  // -------------------------------------------------------------------------

  describe('findByTrigger', () => {
    it('returns templates matching the trigger type', () => {
      const defs = [makeDefinition()];
      registry.findByTrigger.mockReturnValue(defs);
      const result = controller.findByTrigger('erp.order.created');
      expect(registry.findByTrigger).toHaveBeenCalledWith('erp.order.created');
      expect(result).toEqual({ success: true, total: 1, data: defs });
    });

    it('returns empty list for trigger with no templates', () => {
      registry.findByTrigger.mockReturnValue([]);
      const result = controller.findByTrigger('manual');
      expect(result).toEqual({ success: true, total: 0, data: [] });
    });

    it('handles invoice trigger types', () => {
      const defs = [makeDefinition({ trigger: { type: 'erp.invoice.overdue' } })];
      registry.findByTrigger.mockReturnValue(defs);
      const result = controller.findByTrigger('erp.invoice.overdue');
      expect(result.total).toBe(1);
      expect(result.data[0].trigger.type).toBe('erp.invoice.overdue');
    });
  });

  // -------------------------------------------------------------------------
  // POST /validate — validate
  // -------------------------------------------------------------------------

  describe('validate', () => {
    it('returns valid=true for a correct definition', () => {
      registry.validate.mockReturnValue({ valid: true, errors: [] });
      const def = makeDefinition();
      const result = controller.validate(def);
      expect(registry.validate).toHaveBeenCalledWith(def);
      expect(result).toEqual({ success: true, data: { valid: true, errors: [] } });
    });

    it('returns valid=false with errors for invalid definition', () => {
      const errors = ['`id` must be a non-empty string.', '`name` must be a non-empty string.'];
      registry.validate.mockReturnValue({ valid: false, errors });
      const bad = makeDefinition({ id: '', name: '' });
      const result = controller.validate(bad);
      expect(result.data.valid).toBe(false);
      expect(result.data.errors).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id — findById
  // -------------------------------------------------------------------------

  describe('findById', () => {
    it('returns the template for a known ID', () => {
      const def = makeDefinition({ id: 'order-to-invoice' });
      registry.findById.mockReturnValue(def);
      const result = controller.findById('order-to-invoice');
      expect(registry.findById).toHaveBeenCalledWith('order-to-invoice');
      expect(result).toEqual({ success: true, data: def });
    });

    it('propagates NotFoundException for unknown ID', () => {
      registry.findById.mockImplementation(() => {
        throw new NotFoundException('Workflow template "ghost" not found.');
      });
      expect(() => controller.findById('ghost')).toThrow(NotFoundException);
    });
  });
});
