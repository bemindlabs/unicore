import { MockLlmClient } from './mock-llm-client';

describe('MockLlmClient', () => {
  let client: MockLlmClient;

  beforeEach(() => {
    client = new MockLlmClient();
  });

  it('returns a JSON string with an intent field', async () => {
    const result = await client.complete([
      { role: 'system', content: 'classify' },
      { role: 'user', content: 'send an email to the customer' },
    ]);
    const parsed = JSON.parse(result.content);
    expect(parsed).toHaveProperty('intent');
    expect(parsed).toHaveProperty('confidence');
  });

  it('classifies comms-related messages as comms', async () => {
    const result = await client.complete([
      { role: 'user', content: 'draft an email reply to the inbox message' },
    ]);
    const parsed = JSON.parse(result.content);
    expect(parsed.intent).toBe('comms');
  });

  it('classifies finance-related messages as finance', async () => {
    const result = await client.complete([
      { role: 'user', content: 'create an invoice for the client payment' },
    ]);
    const parsed = JSON.parse(result.content);
    expect(parsed.intent).toBe('finance');
  });

  it('classifies ops-related messages as ops', async () => {
    const result = await client.complete([
      { role: 'user', content: 'schedule a task and add it to the calendar' },
    ]);
    const parsed = JSON.parse(result.content);
    expect(parsed.intent).toBe('ops');
  });

  it('returns unknown intent for unrecognised messages', async () => {
    const result = await client.complete([
      { role: 'user', content: 'zzzzz completely unrecognisable zzzzz' },
    ]);
    const parsed = JSON.parse(result.content);
    expect(parsed.intent).toBe('unknown');
    expect(parsed.confidence).toBeLessThan(0.4);
  });

  it('always returns model name mock-llm-v1', async () => {
    const result = await client.complete([{ role: 'user', content: 'hello' }]);
    expect(result.model).toBe('mock-llm-v1');
  });

  it('returns a non-negative totalTokens value', async () => {
    const result = await client.complete([
      { role: 'user', content: 'what are my open orders' },
    ]);
    expect(result.totalTokens).toBeGreaterThan(0);
  });
});
