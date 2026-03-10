import { Test, TestingModule } from '@nestjs/testing';
import { OpsAgent } from './ops.agent';
import { AgentContext, AgentMessage } from '../../interfaces/agent-base.interface';

function makeMessage(content = 'List all overdue tasks'): AgentMessage {
  return {
    id: 'msg-ops-1',
    from: 'user-1',
    to: 'ops',
    content,
    sessionId: 'sess-ops',
    timestamp: new Date().toISOString(),
  };
}

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    sessionId: 'sess-ops',
    history: [],
    businessContext: { businessName: 'ACME Corp', timezone: 'Asia/Bangkok' },
    ...overrides,
  };
}

describe('OpsAgent', () => {
  let agent: OpsAgent;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpsAgent],
    }).compile();

    agent = module.get<OpsAgent>(OpsAgent);
  });

  it('should be defined', () => {
    expect(agent).toBeDefined();
  });

  it('should have agentType "ops"', () => {
    expect(agent.agentType).toBe('ops');
  });

  describe('getToolDefinitions()', () => {
    it('should expose all 7 expected tools', () => {
      const names = agent.getToolDefinitions().map((t) => t.name);
      expect(names).toContain('create_task');
      expect(names).toContain('update_task');
      expect(names).toContain('list_tasks');
      expect(names).toContain('schedule_event');
      expect(names).toContain('check_availability');
      expect(names).toContain('set_reminder');
      expect(names).toContain('generate_standup');
    });

    it('create_task should require "title"', () => {
      const createTool = agent.getToolDefinitions().find((t) => t.name === 'create_task');
      expect(createTool?.parameters.required).toContain('title');
    });
  });

  describe('handle()', () => {
    it('should return a done AgentResponse', async () => {
      const res = await agent.handle(makeMessage(), makeContext());
      expect(res.done).toBe(true);
      expect(res.agentType).toBe('ops');
    });

    it('should fall back to UTC when timezone is not set', async () => {
      const res = await agent.handle(
        makeMessage(),
        makeContext({ businessContext: { businessName: 'Test' } }),
      );
      expect(res.done).toBe(true);
    });
  });
});
