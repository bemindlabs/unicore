import 'reflect-metadata';
import { Transport } from '@nestjs/microservices';
import { buildKafkaOptions, SUBSCRIBED_TOPICS } from '../src/kafka/config/kafka.config';
import { WORKFLOW_TOPICS } from '../src/kafka/constants/kafka.constants';

describe('buildKafkaOptions()', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env after each test
    Object.keys(process.env).forEach((k) => {
      if (!(k in originalEnv)) delete process.env[k];
    });
    Object.assign(process.env, originalEnv);
  });

  it('uses Transport.KAFKA', () => {
    const opts = buildKafkaOptions();
    expect(opts.transport).toBe(Transport.KAFKA);
  });

  it('defaults to localhost:9092 when KAFKA_BROKERS is not set', () => {
    delete process.env['KAFKA_BROKERS'];
    const opts = buildKafkaOptions();
    expect(opts.options?.client?.brokers).toEqual(['localhost:9092']);
  });

  it('parses multiple brokers from KAFKA_BROKERS env var', () => {
    process.env['KAFKA_BROKERS'] = 'broker1:9092, broker2:9092 , broker3:9092';
    const opts = buildKafkaOptions();
    expect(opts.options?.client?.brokers).toEqual([
      'broker1:9092',
      'broker2:9092',
      'broker3:9092',
    ]);
  });

  it('uses KAFKA_CLIENT_ID env var', () => {
    process.env['KAFKA_CLIENT_ID'] = 'my-workflow';
    const opts = buildKafkaOptions();
    expect(opts.options?.client?.clientId).toBe('my-workflow');
  });

  it('defaults clientId to workflow-service', () => {
    delete process.env['KAFKA_CLIENT_ID'];
    const opts = buildKafkaOptions();
    expect(opts.options?.client?.clientId).toBe('workflow-service');
  });

  it('uses KAFKA_CONSUMER_GROUP_ID env var', () => {
    process.env['KAFKA_CONSUMER_GROUP_ID'] = 'custom-group';
    const opts = buildKafkaOptions();
    expect(opts.options?.consumer?.groupId).toBe('custom-group');
  });

  it('defaults groupId to workflow-consumer-group', () => {
    delete process.env['KAFKA_CONSUMER_GROUP_ID'];
    const opts = buildKafkaOptions();
    expect(opts.options?.consumer?.groupId).toBe('workflow-consumer-group');
  });
});

describe('SUBSCRIBED_TOPICS', () => {
  it('includes all 8 expected topics', () => {
    expect(SUBSCRIBED_TOPICS).toHaveLength(8);
    expect(SUBSCRIBED_TOPICS).toContain(WORKFLOW_TOPICS.ORDER_CREATED);
    expect(SUBSCRIBED_TOPICS).toContain(WORKFLOW_TOPICS.ORDER_UPDATED);
    expect(SUBSCRIBED_TOPICS).toContain(WORKFLOW_TOPICS.ORDER_FULFILLED);
    expect(SUBSCRIBED_TOPICS).toContain(WORKFLOW_TOPICS.INVENTORY_LOW);
    expect(SUBSCRIBED_TOPICS).toContain(WORKFLOW_TOPICS.INVENTORY_RESTOCKED);
    expect(SUBSCRIBED_TOPICS).toContain(WORKFLOW_TOPICS.INVOICE_CREATED);
    expect(SUBSCRIBED_TOPICS).toContain(WORKFLOW_TOPICS.INVOICE_OVERDUE);
    expect(SUBSCRIBED_TOPICS).toContain(WORKFLOW_TOPICS.INVOICE_PAID);
  });
});
