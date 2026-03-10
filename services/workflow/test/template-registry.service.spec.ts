import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TemplateRegistryService } from '../src/registry/template-registry.service';
import { TemplateLoaderService } from '../src/loader/template-loader.service';
import type { WorkflowDefinition } from '../src/schema/workflow-definition.schema';
import { WORKFLOW_SCHEMA_VERSION } from '../src/schema/workflow-definition.schema';

function makeDefinition(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  const now = new Date().toISOString();
  return {
    id: 'test-template-001',
    name: 'Test Template',
    enabled: true,
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    trigger: { type: 'erp.order.created', conditions: [] },
    actions: [
      {
        id: 'step-1',
        type: 'call_agent',
        label: 'Call finance agent',
        config: { agentName: 'finance-agent', promptTemplate: 'Process order {{payload.orderId}}' },
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('TemplateRegistryService', () => {
  let registry: TemplateRegistryService;
  let loaderService: TemplateLoaderService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [TemplateLoaderService, TemplateRegistryService],
    }).compile();

    loaderService = module.get<TemplateLoaderService>(TemplateLoaderService);
    registry = module.get<TemplateRegistryService>(TemplateRegistryService);

    // Initialise loader first (populates definitions from disk)
    loaderService.onModuleInit();
  });

  afterEach(async () => {
    await module.close();
  });

  // ---------------------------------------------------------------------------
  // Startup / hydration
  // ---------------------------------------------------------------------------

  describe('onModuleInit', () => {
    it('loads pre-built templates from disk via TemplateLoaderService', () => {
      registry.onModuleInit();
      const templates = registry.findAll();
      expect(templates.length).toBeGreaterThanOrEqual(3);
    });

    it('loads the order-to-invoice template', () => {
      registry.onModuleInit();
      const tpl = registry.findById('order-to-invoice');
      expect(tpl.name).toBe('Order to Invoice');
      expect(tpl.trigger.type).toBe('erp.order.created');
    });

    it('loads the low-stock-reorder template', () => {
      registry.onModuleInit();
      const tpl = registry.findById('low-stock-reorder');
      expect(tpl.name).toBe('Low Stock Reorder');
      expect(tpl.trigger.type).toBe('erp.inventory.low');
    });

    it('loads the invoice-overdue-reminder template', () => {
      registry.onModuleInit();
      const tpl = registry.findById('invoice-overdue-reminder');
      expect(tpl.name).toBe('Invoice Overdue Reminder');
      expect(tpl.trigger.type).toBe('erp.invoice.overdue');
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns only enabled templates by default', () => {
      registry.onModuleInit();
      registry.register(makeDefinition({ id: 'disabled-tpl', enabled: false }));
      const enabled = registry.findAll();
      expect(enabled.every((t) => t.enabled)).toBe(true);
    });

    it('returns all templates including disabled when enabledOnly=false', () => {
      registry.onModuleInit();
      registry.register(makeDefinition({ id: 'disabled-tpl', enabled: false }));
      const all = registry.findAll(false);
      expect(all.some((t) => !t.enabled)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('returns the correct definition', () => {
      const def = makeDefinition({ id: 'unique-tpl', name: 'Unique Template' });
      registry.register(def);
      const found = registry.findById('unique-tpl');
      expect(found.name).toBe('Unique Template');
    });

    it('throws NotFoundException for unknown ID', () => {
      expect(() => registry.findById('ghost')).toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // findByTrigger
  // ---------------------------------------------------------------------------

  describe('findByTrigger', () => {
    it('returns templates matching the trigger type', () => {
      registry.onModuleInit();
      const results = registry.findByTrigger('erp.order.created');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].trigger.type).toBe('erp.order.created');
    });

    it('returns empty array for trigger type with no templates', () => {
      const results = registry.findByTrigger('manual');
      expect(results).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // register
  // ---------------------------------------------------------------------------

  describe('register', () => {
    it('registers a valid definition', () => {
      const def = makeDefinition({ id: 'new-tpl' });
      registry.register(def);
      expect(registry.findById('new-tpl')).toMatchObject({ id: 'new-tpl' });
    });

    it('replaces an existing definition with the same ID', () => {
      const def1 = makeDefinition({ id: 'replace-me', name: 'Original' });
      const def2 = makeDefinition({ id: 'replace-me', name: 'Replaced' });
      registry.register(def1);
      registry.register(def2);
      expect(registry.findById('replace-me').name).toBe('Replaced');
    });

    it('throws BadRequestException for invalid definition', () => {
      const bad = makeDefinition({ id: '', name: '' });
      expect(() => registry.register(bad)).toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // validate
  // ---------------------------------------------------------------------------

  describe('validate', () => {
    it('returns valid=true for a correct definition', () => {
      const result = registry.validate(makeDefinition());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns errors for missing id', () => {
      const result = registry.validate(makeDefinition({ id: '' }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('id'))).toBe(true);
    });

    it('returns errors for missing name', () => {
      const result = registry.validate(makeDefinition({ name: '' }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('name'))).toBe(true);
    });

    it('returns errors for invalid trigger type', () => {
      const def = makeDefinition();
      def.trigger.type = 'unknown.event' as never;
      const result = registry.validate(def);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('trigger.type'))).toBe(true);
    });

    it('requires trigger.cron when trigger.type is schedule.cron', () => {
      const def = makeDefinition({ trigger: { type: 'schedule.cron' } });
      const result = registry.validate(def);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('cron'))).toBe(true);
    });

    it('accepts schedule.cron with a cron expression', () => {
      const def = makeDefinition({ trigger: { type: 'schedule.cron', cron: '0 9 * * 1-5' } });
      const result = registry.validate(def);
      // Only cron error should be absent; other fields still valid
      expect(result.errors.every((e) => !e.includes('cron'))).toBe(true);
    });

    it('returns errors for empty actions array', () => {
      const result = registry.validate(makeDefinition({ actions: [] }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('actions'))).toBe(true);
    });

    it('returns errors for duplicate action IDs', () => {
      const def = makeDefinition({
        actions: [
          {
            id: 'dup',
            type: 'call_agent',
            label: 'A',
            config: { agentName: 'agent', promptTemplate: 'x' },
          },
          {
            id: 'dup',
            type: 'call_agent',
            label: 'B',
            config: { agentName: 'agent', promptTemplate: 'y' },
          },
        ],
      });
      const result = registry.validate(def);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('duplicate'))).toBe(true);
    });

    it('returns errors for dependsOn referencing unknown action ID', () => {
      const def = makeDefinition({
        actions: [
          {
            id: 'step-1',
            type: 'call_agent',
            label: 'A',
            dependsOn: ['ghost-step'],
            config: { agentName: 'agent', promptTemplate: 'x' },
          },
        ],
      });
      const result = registry.validate(def);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('ghost-step'))).toBe(true);
    });
  });
});
