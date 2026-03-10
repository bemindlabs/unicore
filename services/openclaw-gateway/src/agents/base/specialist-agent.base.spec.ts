import { AgentContext, AgentMessage, AgentType } from '../../interfaces/agent-base.interface';
import { SpecialistAgentBase, SpecialistAgentConfig, ToolCall, ToolDefinition, ToolResult } from './specialist-agent.base';

class TestAgent extends SpecialistAgentBase {
  readonly agentType: AgentType = 'comms';
  readonly config: SpecialistAgentConfig = { displayName: 'Test Agent', description: 'Test', version: '0.0.0' };
  protected buildSystemPrompt(_context: AgentContext): string { return 'Test system prompt'; }
  getToolDefinitions(): ToolDefinition[] {
    return [{ name: 'test_tool', description: 'A test tool', parameters: { type: 'object', properties: { input: { type: 'string', description: 'Test input' } }, required: ['input'] } }];
  }
  protected async executeTool(call: ToolCall, _context: AgentContext): Promise<ToolResult> {
    if (call.toolName === 'test_tool') return { toolName: call.toolName, result: { echo: call.arguments['input'] } };
    return { toolName: call.toolName, result: null, error: 'Unknown tool' };
  }
}

function makeMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return { id: 'msg-1', from: 'user-1', to: 'comms', content: 'Hello agent', sessionId: 'sess-1', timestamp: new Date().toISOString(), ...overrides };
}

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return { sessionId: 'sess-1', history: [], businessContext: { businessName: 'ACME Corp' }, ...overrides };
}

describe('SpecialistAgentBase', () => {
  let agent: TestAgent;
  beforeEach(() => { agent = new TestAgent(); });

  describe('isAvailable', () => {
    it('should be available by default', () => { expect(agent.isAvailable()).toBe(true); });
    it('should reflect availability changes via setAvailable()', () => {
      agent.setAvailable(false);
      expect(agent.isAvailable()).toBe(false);
      agent.setAvailable(true);
      expect(agent.isAvailable()).toBe(true);
    });
  });

  describe('handle()', () => {
    it('should return a well-formed AgentResponse', async () => {
      const response = await agent.handle(makeMessage(), makeContext());
      expect(response.requestId).toBe('msg-1');
      expect(response.agentType).toBe('comms');
      expect(response.done).toBe(true);
      expect(typeof response.content).toBe('string');
      expect(response.timestamp).toBeDefined();
    });

    it('should embed available tools in response data', async () => {
      const response = await agent.handle(makeMessage(), makeContext());
      expect(response.data?.['availableTools']).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'test_tool', description: 'A test tool' })]),
      );
    });

    it('should catch errors and return an error AgentResponse', async () => {
      jest.spyOn(agent as unknown as { executeInternal: () => Promise<unknown> }, 'executeInternal')
        .mockRejectedValueOnce(new Error('Simulated failure'));
      const response = await agent.handle(makeMessage(), makeContext());
      expect(response.done).toBe(true);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('AGENT_EXECUTION_ERROR');
      expect(response.error?.message).toBe('Simulated failure');
    });
  });

  describe('getToolDefinitions()', () => {
    it('should return an array of ToolDefinition objects', () => {
      const tools = agent.getToolDefinitions();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      tools.forEach((t) => { expect(t).toHaveProperty('name'); expect(t).toHaveProperty('description'); expect(t.parameters.type).toBe('object'); });
    });
  });
});
