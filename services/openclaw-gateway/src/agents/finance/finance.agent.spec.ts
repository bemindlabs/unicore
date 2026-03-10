import { Test, TestingModule } from '@nestjs/testing';
import { FinanceAgent } from './finance.agent';
import { AgentContext, AgentMessage } from '../../interfaces/agent-base.interface';

function makeMessage(content = 'Show me last month P&L'): AgentMessage {
  return { id: 'msg-finance-1', from: 'user-1', to: 'finance', content, sessionId: 'sess-finance', timestamp: new Date().toISOString() };
}
function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return { sessionId: 'sess-finance', history: [], businessContext: { businessName: 'ACME Corp', currency: 'USD' }, ...overrides };
}

describe('FinanceAgent', () => {
  let agent: FinanceAgent;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({ providers: [FinanceAgent] }).compile();
    agent = module.get<FinanceAgent>(FinanceAgent);
  });

  it('should be defined', () => { expect(agent).toBeDefined(); });
  it('should have agentType "finance"', () => { expect(agent.agentType).toBe('finance'); });

  describe('getToolDefinitions()', () => {
    it('should expose all 7 expected tools', () => {
      const names = agent.getToolDefinitions().map((t) => t.name);
      expect(names).toContain('categorize_transaction');
      expect(names).toContain('list_transactions');
      expect(names).toContain('generate_report');
      expect(names).toContain('forecast_cashflow');
      expect(names).toContain('detect_anomalies');
      expect(names).toContain('create_invoice');
      expect(names).toContain('reconcile_accounts');
    });
  });

  describe('handle()', () => {
    it('should return a done AgentResponse', async () => {
      const res = await agent.handle(makeMessage(), makeContext());
      expect(res.done).toBe(true);
      expect(res.agentType).toBe('finance');
    });
    it('should default to USD when currency is not set', async () => {
      const res = await agent.handle(makeMessage(), makeContext({ businessContext: { businessName: 'Test' } }));
      expect(res.done).toBe(true);
    });
    it('should not throw with no history', async () => {
      await expect(agent.handle(makeMessage(), makeContext({ history: [] }))).resolves.toBeDefined();
    });
  });
});
