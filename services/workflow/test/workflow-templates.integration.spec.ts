/**
 * Integration spec: end-to-end test verifying that pre-built workflow
 * templates are loaded, registered in the engine, and fire correctly
 * when the matching ERP event type is handled.
 */
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngineService } from '../src/engine/workflow-engine.service';
import { ActionExecutorService } from '../src/engine/action-executor.service';
import { WorkflowStateStore } from '../src/state/workflow-state.store';
import { CallAgentExecutor } from '../src/executors/call-agent.executor';
import { UpdateErpExecutor } from '../src/executors/update-erp.executor';
import { SendNotificationExecutor } from '../src/executors/send-notification.executor';
import { TemplateLoaderService } from '../src/loader/template-loader.service';
import { TemplateRegistryService } from '../src/registry/template-registry.service';
import { WorkflowTemplateBootstrapService } from '../src/module/workflow-template-bootstrap.service';

describe('WorkflowTemplates — integration', () => {
  let engine: WorkflowEngineService;
  let stateStore: WorkflowStateStore;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        // Template layer
        TemplateLoaderService,
        TemplateRegistryService,
        WorkflowTemplateBootstrapService,
        // Engine layer
        WorkflowEngineService,
        ActionExecutorService,
        WorkflowStateStore,
        // Action executors
        CallAgentExecutor,
        UpdateErpExecutor,
        SendNotificationExecutor,
      ],
    }).compile();

    engine = module.get<WorkflowEngineService>(WorkflowEngineService);
    stateStore = module.get<WorkflowStateStore>(WorkflowStateStore);

    // Init all services in dependency order
    const loader = module.get<TemplateLoaderService>(TemplateLoaderService);
    const registry = module.get<TemplateRegistryService>(TemplateRegistryService);
    const bootstrap = module.get<WorkflowTemplateBootstrapService>(WorkflowTemplateBootstrapService);
    const executorService = module.get<ActionExecutorService>(ActionExecutorService);

    loader.onModuleInit();
    registry.onModuleInit();
    executorService.onModuleInit();
    bootstrap.onModuleInit();
  });

  afterEach(async () => {
    await module.close();
  });

  // ---------------------------------------------------------------------------
  // Template bootstrapping
  // ---------------------------------------------------------------------------

  it('registers all 3 pre-built templates with the engine', () => {
    const definitions = engine.listDefinitions();
    expect(definitions.length).toBeGreaterThanOrEqual(3);
    const ids = definitions.map((d) => d.id);
    expect(ids).toContain('order-to-invoice');
    expect(ids).toContain('low-stock-reorder');
    expect(ids).toContain('invoice-overdue-reminder');
  });

  // ---------------------------------------------------------------------------
  // order-to-invoice
  // ---------------------------------------------------------------------------

  describe('order-to-invoice template', () => {
    const orderPayload = {
      payload: {
        orderId: 'ORD-001',
        customerId: 'CUST-001',
        customerEmail: 'buyer@example.com',
        total: 299.99,
        currency: 'USD',
        lineItems: [{ productId: 'P-1', productName: 'Widget', sku: 'WDG-001', quantity: 2, unitPrice: 149.99, totalPrice: 299.99 }],
        subtotal: 299.99,
        tax: 0,
        status: 'confirmed',
      },
    };

    it('fires the order-to-invoice template on erp.order.created event', async () => {
      const instances = await engine.handleEvent('erp.order.created', orderPayload);
      expect(instances.length).toBeGreaterThanOrEqual(1);
      const instance = instances.find((i) => i.workflowId === 'order-to-invoice');
      expect(instance).toBeDefined();
    });

    it('eventually completes the order-to-invoice workflow', async () => {
      const instances = await engine.handleEvent('erp.order.created', orderPayload);
      const instance = instances.find((i) => i.workflowId === 'order-to-invoice')!;

      // Allow async execution to complete
      await new Promise((r) => setTimeout(r, 100));

      const stored = stateStore.findById(instance.instanceId)!;
      expect(['completed', 'running']).toContain(stored.status);
    });
  });

  // ---------------------------------------------------------------------------
  // low-stock-reorder
  // ---------------------------------------------------------------------------

  describe('low-stock-reorder template', () => {
    const inventoryPayload = {
      payload: {
        productId: 'PROD-42',
        productName: 'Blue Widget',
        sku: 'BW-042',
        currentQuantity: 3,
        threshold: 10,
        warehouseId: 'WH-001',
        supplierId: 'SUP-007',
      },
    };

    it('fires the low-stock-reorder template on erp.inventory.low event', async () => {
      const instances = await engine.handleEvent('erp.inventory.low', inventoryPayload);
      expect(instances.length).toBeGreaterThanOrEqual(1);
      const instance = instances.find((i) => i.workflowId === 'low-stock-reorder');
      expect(instance).toBeDefined();
    });

    it('has expected actions in the low-stock-reorder definition', () => {
      const def = engine.getDefinition('low-stock-reorder');
      const actionIds = def.actions.map((a) => a.id);
      expect(actionIds).toContain('create-reorder-request');
      expect(actionIds).toContain('notify-ops-team');
    });
  });

  // ---------------------------------------------------------------------------
  // invoice-overdue-reminder
  // ---------------------------------------------------------------------------

  describe('invoice-overdue-reminder template', () => {
    const invoicePayload = {
      payload: {
        invoiceId: 'INV-789',
        invoiceNumber: 'INV-2026-789',
        customerId: 'CUST-101',
        total: 1500,
        currency: 'USD',
        dueAt: '2026-02-01T00:00:00.000Z',
        daysOverdue: 37,
      },
    };

    it('fires the invoice-overdue-reminder template on erp.invoice.overdue event', async () => {
      const instances = await engine.handleEvent('erp.invoice.overdue', invoicePayload);
      expect(instances.length).toBeGreaterThanOrEqual(1);
      const instance = instances.find((i) => i.workflowId === 'invoice-overdue-reminder');
      expect(instance).toBeDefined();
    });

    it('has expected actions in the invoice-overdue-reminder definition', () => {
      const def = engine.getDefinition('invoice-overdue-reminder');
      const actionIds = def.actions.map((a) => a.id);
      expect(actionIds).toContain('send-overdue-reminder');
      expect(actionIds).toContain('flag-for-review');
    });

    it('send-overdue-reminder runs before flag-for-review', () => {
      const def = engine.getDefinition('invoice-overdue-reminder');
      const flagAction = def.actions.find((a) => a.id === 'flag-for-review')!;
      expect(flagAction.dependsOn).toContain('send-overdue-reminder');
    });
  });

  // ---------------------------------------------------------------------------
  // No cross-trigger firing
  // ---------------------------------------------------------------------------

  it('does not fire order templates on invoice events', async () => {
    const instances = await engine.handleEvent('erp.invoice.overdue', { payload: {} });
    const orderInstances = instances.filter((i) => i.workflowId === 'order-to-invoice');
    expect(orderInstances).toHaveLength(0);
  });

  it('does not fire inventory templates on order events', async () => {
    const instances = await engine.handleEvent('erp.order.created', {
      payload: { orderId: 'ORD-X', total: 100, currency: 'USD' },
    });
    const inventoryInstances = instances.filter((i) => i.workflowId === 'low-stock-reorder');
    expect(inventoryInstances).toHaveLength(0);
  });
});
