import { Test, TestingModule } from '@nestjs/testing';
import { RouterAgent } from './router.agent';
import { IntentClassifierService } from './intent-classifier.service';
import { DelegationService } from './delegation.service';
import { LLM_CLIENT } from '../common/llm-client.interface';
import { MockLlmClient } from '../common/mock-llm-client';
import { CommsAgent } from '../agents/comms/comms.agent';
import { FinanceAgent } from '../agents/finance/finance.agent';
import { GrowthAgent } from '../agents/growth/growth.agent';
import { OpsAgent } from '../agents/ops/ops.agent';
import { ResearchAgent } from '../agents/research/research.agent';
import { ErpAgent } from '../agents/erp/erp.agent';
import { BuilderAgent } from '../agents/builder/builder.agent';

function makeAgentStub(type: string) {
  return {
    agentType: type,
    isAvailable: jest.fn().mockReturnValue(true),
    handle: jest.fn().mockImplementation(function(msg) {
      return Promise.resolve({
        requestId: msg.id,
        agentType: type,
        content: 'Stub response from ' + type,
        done: true,
        timestamp: new Date().toISOString(),
      });
    }),
  };
}

describe('RouterAgent', () => {
  let router: RouterAgent;
  let mockClassifier: { classify: jest.Mock };
  let mockDelegation: {
    registerAgent: jest.Mock;
    registeredTypes: jest.Mock;
    delegate: jest.Mock;
  };

  beforeEach(async () => {
    mockClassifier = {
      classify: jest.fn().mockResolvedValue({
        intent: 'comms',
        confidence: 0.9,
        reasoning: 'email keywords detected',
        alternates: [],
      }),
    };

    mockDelegation = {
      registerAgent: jest.fn(),
      registeredTypes: jest.fn().mockReturnValue([
        'comms', 'finance', 'growth', 'ops', 'research', 'erp', 'builder',
      ]),
      delegate: jest.fn().mockResolvedValue({
        response: {
          requestId: 'test-id',
          agentType: 'comms',
          content: 'Mock response from comms agent',
          done: true,
          timestamp: new Date().toISOString(),
        },
        decision: {
          messageId: 'test-id',
          classification: { intent: 'comms', confidence: 0.9, reasoning: 'test', alternates: [] },
          targetAgent: 'comms',
          isFallback: false,
          decidedAt: new Date().toISOString(),
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RouterAgent,
        { provide: IntentClassifierService, useValue: mockClassifier },
        { provide: DelegationService, useValue: mockDelegation },
        { provide: LLM_CLIENT, useClass: MockLlmClient },
        { provide: CommsAgent, useValue: makeAgentStub('comms') },
        { provide: FinanceAgent, useValue: makeAgentStub('finance') },
        { provide: GrowthAgent, useValue: makeAgentStub('growth') },
        { provide: OpsAgent, useValue: makeAgentStub('ops') },
        { provide: ResearchAgent, useValue: makeAgentStub('research') },
        { provide: ErpAgent, useValue: makeAgentStub('erp') },
        { provide: BuilderAgent, useValue: makeAgentStub('builder') },
      ],
    }).compile();

    router = module.get(RouterAgent);
  });

  describe('onModuleInit', () => {
    it('registers all 7 specialist agents with the delegation service', () => {
      router.onModuleInit();
      expect(mockDelegation.registerAgent).toHaveBeenCalledTimes(7);
    });
  });

  describe('process', () => {
    it('calls classifier with the raw user message', async () => {
      await router.process('Send an email to the client', 'session-1', 'user-1');
      expect(mockClassifier.classify).toHaveBeenCalledWith('Send an email to the client');
    });

    it('delegates with the classification result', async () => {
      await router.process('Send an email to the client', 'session-1', 'user-1');
      expect(mockDelegation.delegate).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Send an email to the client', sessionId: 'session-1' }),
        expect.objectContaining({ intent: 'comms', confidence: 0.9 }),
        expect.objectContaining({ sessionId: 'session-1' }),
      );
    });

    it('returns processing time in milliseconds', async () => {
      const result = await router.process('hello', 'session-1', 'user-1');
      expect(typeof result.processingTimeMs).toBe('number');
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('trims whitespace from the raw message before processing', async () => {
      await router.process('  trim me  ', 'session-1', 'user-1');
      expect(mockDelegation.delegate).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'trim me' }),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('includes provided conversation history in the context', async () => {
      const history: Array<{ role: 'user' | 'assistant'; content: string }> = [{ role: 'user', content: 'previous message' }];
      await router.process('follow-up', 'session-1', 'user-1', { history });
      expect(mockDelegation.delegate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({ history }),
      );
    });

    it('returns a structured RouterProcessResult', async () => {
      const result = await router.process('test', 'session-1', 'user-1');
      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('decision');
      expect(result).toHaveProperty('processingTimeMs');
    });

    it('returns error result when classifier throws', async () => {
      mockClassifier.classify.mockRejectedValue(new Error('LLM unavailable'));
      const result = await router.process('any message', 'session-1', 'user-1');
      expect(result.response.error).toBeDefined();
      expect(result.response.error!.code).toBe('ROUTER_ERROR');
      expect(result.decision.isFallback).toBe(true);
      expect(result.decision.targetAgent).toBe('error');
    });

    it('returns error result when delegation throws', async () => {
      mockDelegation.delegate.mockRejectedValue(new Error('Delegation failed'));
      const result = await router.process('any message', 'session-1', 'user-1');
      expect(result.response.error).toBeDefined();
      expect(result.decision.isFallback).toBe(true);
    });

    it('uses empty history array when no context is provided', async () => {
      await router.process('test', 'session-1', 'user-1');
      expect(mockDelegation.delegate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({ history: [] }),
      );
    });
  });
});
