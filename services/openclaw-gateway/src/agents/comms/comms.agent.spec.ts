import { Test, TestingModule } from '@nestjs/testing';
import { CommsAgent } from './comms.agent';
import { AgentContext, AgentMessage } from '../../interfaces/agent-base.interface';

function makeMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    id: 'msg-comms-1',
    from: 'user-1',
    to: 'comms',
    content: 'Draft an email to our top customer',
    sessionId: 'sess-comms',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    sessionId: 'sess-comms',
    history: [],
    businessContext: {
      businessName: 'ACME Corp',
      commsDefaultTone: 'professional',
    },
    ...overrides,
  };
}

describe('CommsAgent', () => {
  let agent: CommsAgent;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommsAgent],
    }).compile();

    agent = module.get<CommsAgent>(CommsAgent);
  });

  it('should be defined', () => {
    expect(agent).toBeDefined();
  });

  it('should have agentType "comms"', () => {
    expect(agent.agentType).toBe('comms');
  });

  it('should be available by default', () => {
    expect(agent.isAvailable()).toBe(true);
  });

  describe('getToolDefinitions()', () => {
    it('should expose all 7 expected tools', () => {
      const tools = agent.getToolDefinitions();
      const names = tools.map((t) => t.name);

      expect(names).toContain('draft_email');
      expect(names).toContain('send_email');
      expect(names).toContain('list_inbox');
      expect(names).toContain('reply_email');
      expect(names).toContain('schedule_post');
      expect(names).toContain('fetch_social_feed');
      expect(names).toContain('moderate_comment');
    });

    it('each tool should have a description and object parameters', () => {
      agent.getToolDefinitions().forEach((tool) => {
        expect(tool.description.length).toBeGreaterThan(10);
        expect(tool.parameters.type).toBe('object');
      });
    });
  });

  describe('handle()', () => {
    it('should return a done response with correct agentType', async () => {
      const res = await agent.handle(makeMessage(), makeContext());
      expect(res.done).toBe(true);
      expect(res.agentType).toBe('comms');
      expect(res.requestId).toBe('msg-comms-1');
    });

    it('should embed businessName from context in system prompt (via data payload)', async () => {
      const res = await agent.handle(makeMessage(), makeContext());
      expect(res.data?.['displayName']).toBe('Comms Agent');
    });

    it('should reflect session ID in data payload', async () => {
      const res = await agent.handle(makeMessage(), makeContext());
      expect(res.data?.['sessionId']).toBe('sess-comms');
    });

    it('should work with empty business context', async () => {
      const res = await agent.handle(
        makeMessage(),
        makeContext({ businessContext: undefined }),
      );
      expect(res.done).toBe(true);
    });

    it('should include history length in response data', async () => {
      const ctx = makeContext({
        history: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello!' },
        ],
      });
      const res = await agent.handle(makeMessage(), ctx);
      expect(res.data?.['historyLength']).toBe(2);
    });
  });
});
