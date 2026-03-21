import { SendTelegramExecutor } from '../src/executors/send-telegram.executor';
import type { ActionExecutionContext } from '../src/executors/action-executor.interface';
import type { SendTelegramAction } from '../src/schema/workflow-definition.schema';

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

const baseContext: ActionExecutionContext = {
  triggerPayload: { orderId: 'ORD-123', customerId: 'CUST-001', chatId: '987654321' },
  previousOutputs: {},
  instanceId: 'inst-001',
  workflowName: 'Telegram Workflow',
};

function makeTelegramAction(overrides: Partial<SendTelegramAction['config']> = {}): SendTelegramAction {
  return {
    id: 'tg-1',
    type: 'send_telegram',
    label: 'Send Telegram',
    config: {
      botToken: 'bot-secret-token',
      chatId: '123456789',
      message: 'Hello from workflow',
      ...overrides,
    },
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, result: { message_id: 42 } }),
    text: async () => 'ok',
  });
});

describe('SendTelegramExecutor', () => {
  let executor: SendTelegramExecutor;

  beforeEach(() => {
    executor = new SendTelegramExecutor();
  });

  it('has correct actionType', () => {
    expect(executor.actionType).toBe('send_telegram');
  });

  describe('validation failures', () => {
    it('returns failure when botToken is missing', async () => {
      const action = makeTelegramAction({ botToken: '' });
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('bot token');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns failure when chatId resolves to empty string', async () => {
      const action = makeTelegramAction({ chatId: '' });
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Chat ID');
    });

    it('returns failure when message resolves to empty string and no template', async () => {
      const action = makeTelegramAction({ message: '', template: undefined });
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Message');
    });
  });

  describe('success cases', () => {
    it('returns success with message_id in output', async () => {
      const action = makeTelegramAction();
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toMatchObject({
        chatId: '123456789',
        messageId: 42,
      });
    });

    it('sends to correct Telegram API endpoint', async () => {
      const action = makeTelegramAction({ botToken: 'my-bot-token' });
      await executor.execute(action, baseContext);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/botmy-bot-token/sendMessage',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('uses default HTML parseMode when not specified', async () => {
      const action = makeTelegramAction();
      await executor.execute(action, baseContext);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.parse_mode).toBe('HTML');
    });

    it('uses specified parseMode (Markdown)', async () => {
      const action = makeTelegramAction({ parseMode: 'Markdown' });
      await executor.execute(action, baseContext);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.parse_mode).toBe('Markdown');
    });

    it('includes messagePreview (truncated to 120 chars) in output', async () => {
      const longMsg = 'A'.repeat(200);
      const action = makeTelegramAction({ message: longMsg });
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(true);
      const preview = (result.output as Record<string, unknown>).messagePreview as string;
      expect(preview.length).toBe(120);
    });
  });

  describe('template interpolation', () => {
    it('interpolates message using trigger payload', async () => {
      const action = makeTelegramAction({ message: 'Order {{payload.orderId}} received' });
      await executor.execute(action, baseContext);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toContain('ORD-123');
    });

    it('uses template over message when both provided', async () => {
      const action = makeTelegramAction({
        message: 'plain message',
        template: 'Template: {{payload.orderId}}',
      });
      await executor.execute(action, baseContext);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toContain('Template:');
      expect(body.text).toContain('ORD-123');
      expect(body.text).not.toBe('plain message');
    });

    it('interpolates chatId from payload', async () => {
      const action = makeTelegramAction({ chatId: '{{payload.chatId}}' });
      await executor.execute(action, baseContext);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.chat_id).toBe('987654321');
    });

    it('interpolates message using previous action outputs', async () => {
      const context: ActionExecutionContext = {
        ...baseContext,
        previousOutputs: { 'step-1': { invoiceId: 'INV-999' } },
      };
      const action = makeTelegramAction({ message: 'Invoice {{outputs.step-1.invoiceId}} ready' });
      await executor.execute(action, context);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toContain('INV-999');
    });
  });

  describe('API error handling', () => {
    it('returns failure when Telegram API returns ok=false', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }),
      });
      const action = makeTelegramAction();
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('chat not found');
    });

    it('returns failure when API returns ok=false with no description', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: false, error_code: 403 }),
      });
      const action = makeTelegramAction();
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('403');
    });

    it('returns failure on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network unreachable'));
      const action = makeTelegramAction();
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network unreachable');
    });

    it('returns failure on JSON parse error from API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => { throw new Error('Unexpected token'); },
      });
      const action = makeTelegramAction();
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(false);
    });
  });
});
