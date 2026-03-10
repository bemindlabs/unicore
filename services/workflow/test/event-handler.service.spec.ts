import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { EventHandlerService } from '../src/kafka/event-handler.service';
import { EventEnvelopeDto } from '../src/kafka/dto/event-envelope.dto';
import { WORKFLOW_TOPICS } from '../src/kafka/constants/kafka.constants';

function makeEnvelope<T>(payload: T): EventEnvelopeDto<T> {
  return {
    eventId: 'test-event-id-001',
    occurredAt: '2026-03-10T10:00:00.000Z',
    type: WORKFLOW_TOPICS.ORDER_CREATED,
    source: 'erp-service',
    schemaVersion: 1,
    payload,
  };
}

describe('EventHandlerService', () => {
  let service: EventHandlerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventHandlerService],
    }).compile();

    service = module.get<EventHandlerService>(EventHandlerService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('handle()', () => {
    it('calls the handler with the envelope payload', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      const payload = { orderId: 'ord-001', customerId: 'cust-001' };
      const envelope = makeEnvelope(payload);

      await service.handle(envelope, handler);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('re-throws handler errors so Kafka can apply retry policy', async () => {
      const error = new Error('downstream failure');
      const handler = jest.fn().mockRejectedValue(error);
      const envelope = makeEnvelope({ orderId: 'ord-002' });

      await expect(service.handle(envelope, handler)).rejects.toThrow('downstream failure');
    });

    it('calls recordResult with success=true on success', async () => {
      const recordSpy = jest.spyOn(service, 'recordResult');
      const envelope = makeEnvelope({ orderId: 'ord-003' });
      const handler = jest.fn().mockResolvedValue(undefined);

      await service.handle(envelope, handler);

      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          eventId: 'test-event-id-001',
          topic: WORKFLOW_TOPICS.ORDER_CREATED,
        }),
      );
    });

    it('calls recordResult with success=false on failure', async () => {
      const recordSpy = jest.spyOn(service, 'recordResult');
      const envelope = makeEnvelope({ orderId: 'ord-004' });
      const handler = jest.fn().mockRejectedValue(new Error('oops'));

      await expect(service.handle(envelope, handler)).rejects.toThrow();

      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'oops',
        }),
      );
    });

    it('records a non-zero durationMs even for fast handlers', async () => {
      const recordSpy = jest.spyOn(service, 'recordResult');
      const envelope = makeEnvelope({ orderId: 'ord-005' });
      const handler = jest.fn().mockResolvedValue(undefined);

      await service.handle(envelope, handler);

      const result = recordSpy.mock.calls[0]?.[0];
      expect(result).toBeDefined();
      expect(typeof result!.durationMs).toBe('number');
      expect(result!.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('recordResult()', () => {
    it('does not throw for a successful result', () => {
      expect(() =>
        service.recordResult({
          topic: WORKFLOW_TOPICS.INVOICE_PAID,
          eventId: 'evt-123',
          success: true,
          durationMs: 12,
        }),
      ).not.toThrow();
    });

    it('does not throw for a failed result', () => {
      expect(() =>
        service.recordResult({
          topic: WORKFLOW_TOPICS.INVOICE_OVERDUE,
          eventId: 'evt-456',
          success: false,
          durationMs: 5,
          error: 'something went wrong',
        }),
      ).not.toThrow();
    });
  });
});
