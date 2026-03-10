import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { KafkaConsumerModule } from '../src/kafka/kafka-consumer.module';
import { EventHandlerService } from '../src/kafka/event-handler.service';
import { OrderConsumerService } from '../src/kafka/consumers/order.consumer';
import { InventoryConsumerService } from '../src/kafka/consumers/inventory.consumer';
import { InvoiceConsumerService } from '../src/kafka/consumers/invoice.consumer';
import { WorkflowService } from '../src/workflow/workflow.service';
import { WorkflowEngineService } from '../src/engine/workflow-engine.service';
import { WorkflowStateStore } from '../src/state/workflow-state.store';
import { ActionExecutorService } from '../src/engine/action-executor.service';
import { CallAgentExecutor } from '../src/executors/call-agent.executor';
import { UpdateErpExecutor } from '../src/executors/update-erp.executor';
import { SendNotificationExecutor } from '../src/executors/send-notification.executor';

describe('KafkaConsumerModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [KafkaConsumerModule],
    })
      // Provide mocks for all workflow engine dependencies so the module
      // compiles cleanly without real infrastructure.
      .overrideProvider(WorkflowService)
      .useValue({ handleEvent: jest.fn().mockResolvedValue([]) })
      .overrideProvider(WorkflowEngineService)
      .useValue({})
      .overrideProvider(WorkflowStateStore)
      .useValue({})
      .overrideProvider(ActionExecutorService)
      .useValue({})
      .overrideProvider(CallAgentExecutor)
      .useValue({})
      .overrideProvider(UpdateErpExecutor)
      .useValue({})
      .overrideProvider(SendNotificationExecutor)
      .useValue({})
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('compiles and wires all providers', () => {
    expect(module).toBeDefined();
  });

  it('provides EventHandlerService', () => {
    const svc = module.get<EventHandlerService>(EventHandlerService);
    expect(svc).toBeInstanceOf(EventHandlerService);
  });

  it('provides OrderConsumerService', () => {
    const svc = module.get<OrderConsumerService>(OrderConsumerService);
    expect(svc).toBeInstanceOf(OrderConsumerService);
  });

  it('provides InventoryConsumerService', () => {
    const svc = module.get<InventoryConsumerService>(InventoryConsumerService);
    expect(svc).toBeInstanceOf(InventoryConsumerService);
  });

  it('provides InvoiceConsumerService', () => {
    const svc = module.get<InvoiceConsumerService>(InvoiceConsumerService);
    expect(svc).toBeInstanceOf(InvoiceConsumerService);
  });
});
