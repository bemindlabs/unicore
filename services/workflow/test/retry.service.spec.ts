import { Test, TestingModule } from '@nestjs/testing';
import { RetryService, RetryContext } from '../src/kafka/retry/retry.service';
import { DlqService } from '../src/kafka/dlq/dlq.service';
import { EventHandlerService } from '../src/kafka/event-handler.service';

const makeDlqService = (): jest.Mocked<DlqService> =>
  ({ publish: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<DlqService>);

const makeEventHandlerService = (): jest.Mocked<EventHandlerService> =>
  ({ recordRetryAttempt: jest.fn() } as unknown as jest.Mocked<EventHandlerService>);

const BASE_CONTEXT: RetryContext = {
  topic: 'order.created',
  eventId: 'evt-123',
  originalPayload: { orderId: 'ord-1' },
  maxRetries: 3,
  baseDelayMs: 0, // no delay in tests
};

describe('RetryService', () => {
  let service: RetryService;
  let dlqService: jest.Mocked<DlqService>;
  let eventHandlerService: jest.Mocked<EventHandlerService>;

  beforeEach(async () => {
    dlqService = makeDlqService();
    eventHandlerService = makeEventHandlerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetryService,
        { provide: DlqService, useValue: dlqService },
        { provide: EventHandlerService, useValue: eventHandlerService },
      ],
    }).compile();

    service = module.get<RetryService>(RetryService);
  });

  describe('withRetry', () => {
    it('returns succeeded=true and retryCount=0 when fn succeeds on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue(undefined);

      const result = await service.withRetry(fn, BASE_CONTEXT);

      expect(result).toEqual({ retryCount: 0, succeeded: true });
      expect(fn).toHaveBeenCalledTimes(1);
      expect(dlqService.publish).not.toHaveBeenCalled();
    });

    it('retries on failure and succeeds on second attempt', async () => {
      const error = new Error('transient error');
      const fn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined);

      const result = await service.withRetry(fn, BASE_CONTEXT);

      expect(result).toEqual({ retryCount: 1, succeeded: true });
      expect(fn).toHaveBeenCalledTimes(2);
      expect(dlqService.publish).not.toHaveBeenCalled();
      expect(eventHandlerService.recordRetryAttempt).toHaveBeenCalledWith(
        'order.created',
        'evt-123',
        1,
        3,
      );
    });

    it('retries on failure and succeeds on third attempt', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce(undefined);

      const result = await service.withRetry(fn, BASE_CONTEXT);

      expect(result).toEqual({ retryCount: 2, succeeded: true });
      expect(fn).toHaveBeenCalledTimes(3);
      expect(dlqService.publish).not.toHaveBeenCalled();
    });

    it('routes to DLQ after all retries are exhausted', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('permanent error'));

      const result = await service.withRetry(fn, BASE_CONTEXT);

      expect(result).toEqual({ retryCount: 3, succeeded: false });
      expect(fn).toHaveBeenCalledTimes(3);
      expect(dlqService.publish).toHaveBeenCalledTimes(1);

      const published = dlqService.publish.mock.calls[0][0];
      expect(published.originalTopic).toBe('order.created');
      expect(published.dlqTopic).toBe('dlq.order');
      expect(published.eventId).toBe('evt-123');
      expect(published.payload).toEqual({ orderId: 'ord-1' });
      expect(published.errorMessage).toBe('permanent error');
      expect(published.retryCount).toBe(3);
      expect(published.id).toBeDefined();
      expect(published.timestamp).toBeDefined();
    });

    it('wraps non-Error throws in an Error for DLQ entry', async () => {
      const fn = jest.fn().mockRejectedValue('plain string error');

      await service.withRetry(fn, BASE_CONTEXT);

      const published = dlqService.publish.mock.calls[0][0];
      expect(published.errorMessage).toBe('plain string error');
    });

    it('does not throw even when all retries fail', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fatal'));

      await expect(service.withRetry(fn, BASE_CONTEXT)).resolves.not.toThrow();
    });

    it('records a retry attempt via EventHandlerService on each failure', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(undefined);

      await service.withRetry(fn, BASE_CONTEXT);

      expect(eventHandlerService.recordRetryAttempt).toHaveBeenCalledTimes(1);
      expect(eventHandlerService.recordRetryAttempt).toHaveBeenCalledWith(
        'order.created',
        'evt-123',
        1,
        3,
      );
    });

    it('uses correct DLQ topic per domain', async () => {
      const cases: Array<[string, string]> = [
        ['order.created', 'dlq.order'],
        ['inventory.low', 'dlq.inventory'],
        ['invoice.overdue', 'dlq.invoice'],
        ['chat.message.inbound', 'dlq.chat'],
      ];

      for (const [topic, expectedDlq] of cases) {
        dlqService.publish.mockClear();
        const fn = jest.fn().mockRejectedValue(new Error('err'));
        await service.withRetry(fn, { ...BASE_CONTEXT, topic });
        expect(dlqService.publish.mock.calls[0][0].dlqTopic).toBe(expectedDlq);
      }
    });

    it('respects custom maxRetries from context', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      const result = await service.withRetry(fn, { ...BASE_CONTEXT, maxRetries: 1 });

      expect(fn).toHaveBeenCalledTimes(1);
      expect(result.retryCount).toBe(1);
      expect(result.succeeded).toBe(false);
      expect(dlqService.publish).toHaveBeenCalledTimes(1);
    });
  });
});
