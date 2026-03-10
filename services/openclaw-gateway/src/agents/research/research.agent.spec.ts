import { Test, TestingModule } from '@nestjs/testing';
import { ResearchAgent } from './research.agent';
import { AgentContext, AgentMessage } from '../../interfaces/agent-base.interface';

function makeMessage(content = 'Research our top 3 competitors'): AgentMessage {
  return {
    id: 'msg-research-1',
    from: 'user-1',
    to: 'research',
    content,
    sessionId: 'sess-research',
    timestamp: new Date().toISOString(),
  };
}

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    sessionId: 'sess-research',
    history: [],
    businessContext: { businessName: 'ACME Corp', industry: 'SaaS' },
    ...overrides,
  };
}

describe('ResearchAgent', () => {
  let agent: ResearchAgent;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ResearchAgent],
    }).compile();

    agent = module.get<ResearchAgent>(ResearchAgent);
  });

  it('should be defined', () => {
    expect(agent).toBeDefined();
  });

  it('should have agentType "research"', () => {
    expect(agent.agentType).toBe('research');
  });

  describe('getToolDefinitions()', () => {
    it('should expose all 7 expected tools', () => {
      const names = agent.getToolDefinitions().map((t) => t.name);
      expect(names).toContain('search_web');
      expect(names).toContain('analyse_competitor');
      expect(names).toContain('monitor_keywords');
      expect(names).toContain('summarise_document');
      expect(names).toContain('generate_market_brief');
      expect(names).toContain('track_trends');
      expect(names).toContain('benchmark_pricing');
    });

    it('search_web should require "query"', () => {
      const tool = agent.getToolDefinitions().find((t) => t.name === 'search_web');
      expect(tool?.parameters.required).toContain('query');
    });

    it('benchmark_pricing should require "productDescription" and "currentPrice"', () => {
      const tool = agent.getToolDefinitions().find((t) => t.name === 'benchmark_pricing');
      expect(tool?.parameters.required).toContain('productDescription');
      expect(tool?.parameters.required).toContain('currentPrice');
    });
  });

  describe('handle()', () => {
    it('should return a done AgentResponse', async () => {
      const res = await agent.handle(makeMessage(), makeContext());
      expect(res.done).toBe(true);
      expect(res.agentType).toBe('research');
    });

    it('should fall back to "your industry" when industry is not set', async () => {
      const res = await agent.handle(
        makeMessage(),
        makeContext({ businessContext: { businessName: 'Test' } }),
      );
      expect(res.done).toBe(true);
    });
  });
});
