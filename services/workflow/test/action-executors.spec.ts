import { CallAgentExecutor } from '../src/executors/call-agent.executor';
import { UpdateErpExecutor } from '../src/executors/update-erp.executor';
import { SendNotificationExecutor } from '../src/executors/send-notification.executor';
import type { ActionExecutionContext } from '../src/executors/action-executor.interface';
import type {
  CallAgentAction,
  UpdateErpAction,
  SendNotificationAction,
} from '../src/schema/workflow-definition.schema';

// Trigger payload shape: { payload: { ... } }
// In executor the triggerPayload is spread at root, so {{payload.orderId}} resolves correctly.
const baseContext: ActionExecutionContext = {
  triggerPayload: { payload: { orderId: 'ORD-42', amount: 150, customer: 'alice@example.com' } },
  previousOutputs: {},
  instanceId: 'test-instance',
  workflowName: 'Test Workflow',
};

describe('CallAgentExecutor', () => {
  let executor: CallAgentExecutor;
  beforeEach(() => { executor = new CallAgentExecutor(); });

  it('has correct actionType', () => {
    expect(executor.actionType).toBe('call_agent');
  });

  it('returns success with interpolated prompt', async () => {
    const action: CallAgentAction = {
      id: 'a1',
      type: 'call_agent',
      label: 'Notify agent',
      config: {
        agentName: 'ops-agent',
        promptTemplate: 'Process order {{payload.orderId}} worth {{payload.amount}}',
      },
    };

    const result = await executor.execute(action, baseContext);

    expect(result.success).toBe(true);
    expect(result.output).toMatchObject({ agentName: 'ops-agent' });
    expect((result.output as Record<string, string>).prompt).toContain('ORD-42');
    expect((result.output as Record<string, string>).prompt).toContain('150');
  });

  it('interpolates using previous action outputs', async () => {
    const context: ActionExecutionContext = {
      ...baseContext,
      previousOutputs: { a0: { invoiceNumber: 'INV-99' } },
    };
    const action: CallAgentAction = {
      id: 'a1',
      type: 'call_agent',
      label: 'Agent with output ref',
      config: {
        agentName: 'finance-agent',
        promptTemplate: 'Invoice {{outputs.a0.invoiceNumber}} needs processing',
      },
    };

    const result = await executor.execute(action, context);
    expect(result.success).toBe(true);
    expect((result.output as Record<string, string>).prompt).toContain('INV-99');
  });
});

describe('UpdateErpExecutor', () => {
  let executor: UpdateErpExecutor;
  beforeEach(() => { executor = new UpdateErpExecutor(); });

  it('has correct actionType', () => {
    expect(executor.actionType).toBe('update_erp');
  });

  it('returns success with resolved entity data', async () => {
    const action: UpdateErpAction = {
      id: 'a2',
      type: 'update_erp',
      label: 'Update order status',
      config: {
        entity: 'order',
        entityId: '{{payload.orderId}}',
        fields: { status: 'fulfilled', processedAt: '2026-03-10' },
      },
    };

    const result = await executor.execute(action, baseContext);

    expect(result.success).toBe(true);
    expect(result.output).toMatchObject({
      entity: 'order',
      entityId: 'ORD-42',
      updatedFields: { status: 'fulfilled', processedAt: '2026-03-10' },
    });
  });

  it('returns failure when entityId resolves to empty string', async () => {
    const action: UpdateErpAction = {
      id: 'a2',
      type: 'update_erp',
      label: 'Bad entity update',
      config: {
        entity: 'invoice',
        entityId: '',
        fields: { status: 'paid' },
      },
    };

    const result = await executor.execute(action, baseContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain('entityId');
  });
});

describe('SendNotificationExecutor', () => {
  let executor: SendNotificationExecutor;
  beforeEach(() => { executor = new SendNotificationExecutor(); });

  it('has correct actionType', () => {
    expect(executor.actionType).toBe('send_notification');
  });

  it('returns success with interpolated notification data', async () => {
    const action: SendNotificationAction = {
      id: 'a3',
      type: 'send_notification',
      label: 'Email customer',
      config: {
        channel: 'email',
        recipient: '{{payload.customer}}',
        subject: 'Order {{payload.orderId}} confirmed',
        bodyTemplate: 'Your order {{payload.orderId}} for ${{payload.amount}} is confirmed.',
      },
    };

    const result = await executor.execute(action, baseContext);

    expect(result.success).toBe(true);
    expect(result.output).toMatchObject({
      channel: 'email',
      recipient: 'alice@example.com',
      subject: 'Order ORD-42 confirmed',
    });
  });

  it('returns failure when recipient resolves to empty string', async () => {
    const action: SendNotificationAction = {
      id: 'a3',
      type: 'send_notification',
      label: 'Bad notification',
      config: {
        channel: 'slack',
        recipient: '',
        subject: 'Test',
        bodyTemplate: 'Test body',
      },
    };

    const result = await executor.execute(action, baseContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Recipient');
  });
});
