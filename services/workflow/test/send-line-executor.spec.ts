import { SendLineExecutor } from '../src/executors/send-line.executor';
import type { ActionExecutionContext } from '../src/executors/action-executor.interface';
import type { SendLineAction } from '../src/schema/workflow-definition.schema';

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

const baseContext: ActionExecutionContext = {
  triggerPayload: { customerId: 'CUST-123', lineUserId: 'U-line-987', orderId: 'ORD-456' },
  previousOutputs: {},
  instanceId: 'inst-002',
  workflowName: 'LINE Workflow',
};

function makeLineAction(overrides: Partial<SendLineAction['config']> = {}): SendLineAction {
  return {
    id: 'line-1',
    type: 'send_line',
    label: 'Send LINE',
    config: {
      accessToken: 'line-channel-token',
      to: 'U-abc123',
      message: 'Hello from workflow',
      ...overrides,
    },
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({}),
    text: async () => 'ok',
  });
});

describe('SendLineExecutor', () => {
  let executor: SendLineExecutor;

  beforeEach(() => {
    executor = new SendLineExecutor();
  });

  it('has correct actionType', () => {
    expect(executor.actionType).toBe('send_line');
  });

  describe('validation failures', () => {
    it('returns failure when accessToken is missing', async () => {
      const action = makeLineAction({ accessToken: '' });
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('access token');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns failure when to resolves to empty string', async () => {
      const action = makeLineAction({ to: '' });
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Recipient ID');
    });

    it('returns failure when message resolves to empty string and no template', async () => {
      const action = makeLineAction({ message: '', template: undefined });
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Message');
    });
  });

  describe('success cases', () => {
    it('returns success with to and messagePreview in output', async () => {
      const action = makeLineAction();
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toMatchObject({ to: 'U-abc123' });
    });

    it('sends POST to LINE Messaging API endpoint', async () => {
      const action = makeLineAction();
      await executor.execute(action, baseContext);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('includes Authorization header with Bearer token', async () => {
      const action = makeLineAction({ accessToken: 'my-line-token' });
      await executor.execute(action, baseContext);
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer my-line-token');
    });

    it('sends message in correct LINE push format', async () => {
      const action = makeLineAction({ to: 'U-target', message: 'test message' });
      await executor.execute(action, baseContext);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.to).toBe('U-target');
      expect(body.messages).toEqual([{ type: 'text', text: 'test message' }]);
    });

    it('truncates messagePreview to 120 chars', async () => {
      const longMsg = 'B'.repeat(200);
      const action = makeLineAction({ message: longMsg });
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(true);
      const preview = (result.output as Record<string, unknown>).messagePreview as string;
      expect(preview.length).toBe(120);
    });
  });

  describe('template interpolation', () => {
    it('interpolates message using trigger payload', async () => {
      const action = makeLineAction({ message: 'Your order {{payload.orderId}} is ready' });
      await executor.execute(action, baseContext);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[0].text).toContain('ORD-456');
    });

    it('uses template over message when both provided', async () => {
      const action = makeLineAction({
        message: 'ignored message',
        template: 'Template for {{payload.customerId}}',
      });
      await executor.execute(action, baseContext);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[0].text).toContain('CUST-123');
      expect(body.messages[0].text).not.toBe('ignored message');
    });

    it('interpolates to field from payload', async () => {
      const action = makeLineAction({ to: '{{payload.lineUserId}}' });
      await executor.execute(action, baseContext);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.to).toBe('U-line-987');
    });

    it('interpolates using previous action outputs', async () => {
      const context: ActionExecutionContext = {
        ...baseContext,
        previousOutputs: { 'gen-invoice': { invoiceUrl: 'https://example.com/inv/1' } },
      };
      const action = makeLineAction({ message: 'Invoice: {{outputs.gen-invoice.invoiceUrl}}' });
      await executor.execute(action, context);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[0].text).toContain('https://example.com/inv/1');
    });
  });

  describe('API error handling', () => {
    it('returns failure when LINE API returns non-ok HTTP status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid access token' }),
      });
      const action = makeLineAction();
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid access token');
    });

    it('returns failure with status code when API returns non-ok and no message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      });
      const action = makeLineAction();
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('returns failure on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));
      const action = makeLineAction();
      const result = await executor.execute(action, baseContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });
  });
});
