import { Test, TestingModule } from '@nestjs/testing';
import { GrowthAgent } from './growth.agent';
import { AgentContext, AgentMessage } from '../../interfaces/agent-base.interface';

function makeMessage(content = 'Analyse our funnel for last 30 days'): AgentMessage {
  return {
    id: 'msg-growth-1',
    from: 'user-1',
    to: 'growth',
    content,
    sessionId: 'sess-growth',
    timestamp: new Date().toISOString(),
  };
}

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    sessionId: 'sess-growth',
    history: [],
    businessContext: { businessName: 'ACME Corp', currency: 'USD' },
    ...overrides,
  };
}

describe('GrowthAgent', () => {
  let agent: GrowthAgent;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GrowthAgent],
    }).compile();

    agent = module.get<GrowthAgent>(GrowthAgent);
  });

  it('should be defined', () => {
    expect(agent).toBeDefined();
  });

  it('should have agentType "growth"', () => {
    expect(agent.agentType).toBe('growth');
  });

  describe('getToolDefinitions()', () => {
    it('should expose all 7 expected tools', () => {
      const names = agent.getToolDefinitions().map((t) => t.name);
      expect(names).toContain('analyse_funnel');
      expect(names).toContain('identify_drop_offs');
      expect(names).toContain('get_ad_performance');
      expect(names).toContain('adjust_ad_budget');
      expect(names).toContain('create_campaign');
      expect(names).toContain('generate_utm');
      expect(names).toContain('segment_audience');
    });
  });

  describe('handle()', () => {
    it('should return a done AgentResponse', async () => {
      const res = await agent.handle(makeMessage(), makeContext());
      expect(res.done).toBe(true);
      expect(res.agentType).toBe('growth');
    });

    it('should not throw with missing optional context', async () => {
      await expect(
        agent.handle(makeMessage(), makeContext({ businessContext: undefined })),
      ).resolves.toBeDefined();
    });
  });
});
