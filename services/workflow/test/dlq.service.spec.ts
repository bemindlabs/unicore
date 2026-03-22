import { Test, TestingModule } from '@nestjs/testing';
import { DlqService, DlqEntry } from '../src/kafka/dlq/dlq.service';

// Mock kafkajs so tests don't need a real Kafka broker
jest.mock('kafkajs', () => {
  const mockProducer = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined),
  };
  return {
    Kafka: jest.fn().mockImplementation(() => ({
      producer: jest.fn().mockReturnValue(mockProducer),
    })),
  };
});

const makeEntry = (overrides: Partial<DlqEntry> = {}): DlqEntry => ({
  id: 'dlq-1',
  originalTopic: 'order.created',
  dlqTopic: 'dlq.order',
  eventId: 'evt-1',
  payload: { orderId: 'ord-1' },
  errorMessage: 'workflow failed',
  retryCount: 3,
  timestamp: new Date(1000).toISOString(),
  ...overrides,
});

describe('DlqService', () => {
  let service: DlqService;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let mockProducer: ReturnType<typeof jest.fn>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [DlqService],
    }).compile();

    service = module.get<DlqService>(DlqService);
    await service.onModuleInit();

    // Grab the producer mock from the kafkajs mock
    const { Kafka } = jest.requireMock('kafkajs') as { Kafka: jest.Mock };
    mockProducer = Kafka.mock.results[0].value.producer();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('publish', () => {
    it('stores the entry in the in-memory store', async () => {
      const entry = makeEntry();
      await service.publish(entry);
      expect(service.get('dlq-1')).toEqual(entry);
    });

    it('sends the entry to the Kafka DLQ topic', async () => {
      const entry = makeEntry();
      await service.publish(entry);

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'dlq.order',
        messages: [
          {
            key: 'evt-1',
            value: JSON.stringify(entry),
          },
        ],
      });
    });

    it('still stores the entry if Kafka send fails', async () => {
      mockProducer.send.mockRejectedValueOnce(new Error('broker unavailable'));
      const entry = makeEntry({ id: 'dlq-2' });

      await expect(service.publish(entry)).resolves.not.toThrow();
      expect(service.get('dlq-2')).toEqual(entry);
    });
  });

  describe('list', () => {
    it('returns an empty array when no entries exist', () => {
      expect(service.list()).toEqual([]);
    });

    it('returns all published entries sorted newest first', async () => {
      const older = makeEntry({ id: 'dlq-a', timestamp: new Date(1000).toISOString() });
      const newer = makeEntry({ id: 'dlq-b', timestamp: new Date(2000).toISOString() });

      await service.publish(older);
      await service.publish(newer);

      const list = service.list();
      expect(list[0].id).toBe('dlq-b');
      expect(list[1].id).toBe('dlq-a');
    });

    it('returns a snapshot (not a live reference)', async () => {
      await service.publish(makeEntry({ id: 'dlq-snap' }));
      const list1 = service.list();
      await service.publish(makeEntry({ id: 'dlq-snap-2' }));
      // Original list should still have only 1 entry
      expect(list1).toHaveLength(1);
    });
  });

  describe('get', () => {
    it('returns undefined for unknown id', () => {
      expect(service.get('nonexistent')).toBeUndefined();
    });

    it('returns the entry for a known id', async () => {
      const entry = makeEntry({ id: 'dlq-get' });
      await service.publish(entry);
      expect(service.get('dlq-get')).toEqual(entry);
    });
  });

  describe('markRetried', () => {
    it('returns false for unknown id', () => {
      expect(service.markRetried('nonexistent')).toBe(false);
    });

    it('returns true and sets retriedAt for a known id', async () => {
      await service.publish(makeEntry({ id: 'dlq-retry' }));

      const result = service.markRetried('dlq-retry');

      expect(result).toBe(true);
      const updated = service.get('dlq-retry');
      expect(updated?.retriedAt).toBeDefined();
      expect(new Date(updated!.retriedAt!).getTime()).toBeGreaterThan(0);
    });

    it('does not mutate other fields when marking retried', async () => {
      const entry = makeEntry({ id: 'dlq-immut' });
      await service.publish(entry);

      service.markRetried('dlq-immut');

      const updated = service.get('dlq-immut');
      expect(updated?.originalTopic).toBe(entry.originalTopic);
      expect(updated?.errorMessage).toBe(entry.errorMessage);
      expect(updated?.retryCount).toBe(entry.retryCount);
    });
  });
});
