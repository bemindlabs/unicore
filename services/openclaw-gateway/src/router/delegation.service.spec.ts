import { Test, TestingModule } from '@nestjs/testing';
import { DelegationService } from './delegation.service';
import type {
  AgentContext,
  AgentMessage,
  AgentResponse,
  AgentType,
  ISpecialistAgent,
} from '../interfaces/agent-base.interface';
import type { ClassificationResult } from '../interfaces/classification.interface';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeMessage = (content = 'hello'): AgentMessage => ({
  id: uuidv4(),
  from: 'user-1',
  to: 'router',
  content,
  sessionId: 'session-1',
  timestamp: new Date().toISOString(),
});

const makeContext = (): AgentContext => ({
  sessionId: 'session-1',
  history: [],
});

const makeClassification = (
  intent: string,
  confidence = 0.9,
): ClassificationResult => ({
  intent: intent as ClassificationResult['intent'],
  confidence,
  reasoning: 'test',
  alternates: [],
});

const makeAgent = (type: AgentType, available = true): ISpecialistAgent => ({
  agentType: type,
  isAvailable: jest.fn(() => available),
  handle: jest.fn(async (msg: AgentMessage): Promise<AgentResponse> => ({
    requestId: msg.id,
    agentType: type,
    content: `Response from ${type} agent`,
    done: true,
    timestamp: new Date().toISOString(),
  })),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DelegationService', () => {
  let service: DelegationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DelegationService],
    }).compile();

    service = module.get<DelegationService>(DelegationService);
  });

  describe('registerAgent', () => {
    it('registers an agent and makes it available for routing', () => {
      const agent = makeAgent('comms');
      service.registerAgent(agent);
      expect(service.registeredTypes()).toContain('comms');
    });

    it('overwrites a previously registered agent of the same type', () => {
      const agent1 = makeAgent('finance');
      const agent2 = makeAgent('finance');
      service.registerAgent(agent1);
      service.registerAgent(agent2);
      expect(service.registeredTypes().filter((t) => t === 'finance')).toHaveLength(1);
    });
  });

  describe('delegate — successful routing', () => {
    it('routes to the correct specialist agent based on intent', async () => {
      const commsAgent = makeAgent('comms');
      service.registerAgent(commsAgent);

      const { response, decision } = await service.delegate(
        makeMessage('Send a reply to the client'),
        makeClassification('comms'),
        makeContext(),
      );

      expect(commsAgent.handle).toHaveBeenCalledTimes(1);
      expect(response.agentType).toBe('comms');
      expect(decision.targetAgent).toBe('comms');
      expect(decision.isFallback).toBe(false);
    });

    it('passes the original message and context to the agent', async () => {
      const opsAgent = makeAgent('ops');
      service.registerAgent(opsAgent);

      const message = makeMessage('Schedule a meeting');
      const context = makeContext();

      await service.delegate(message, makeClassification('ops'), context);

      expect(opsAgent.handle).toHaveBeenCalledWith(message, context);
    });

    it('sets isFallback=false for a successful delegation', async () => {
      service.registerAgent(makeAgent('finance'));
      const { decision } = await service.delegate(
        makeMessage(),
        makeClassification('finance'),
        makeContext(),
      );
      expect(decision.isFallback).toBe(false);
    });
  });

  describe('delegate — fallback handling', () => {
    it('returns fallback response when intent is unknown', async () => {
      const { response, decision } = await service.delegate(
        makeMessage('something unclear'),
        makeClassification('unknown', 0),
        makeContext(),
      );

      expect(decision.isFallback).toBe(true);
      expect(decision.targetAgent).toBe('fallback');
      expect(response.agentType).toBe('router');
      expect(response.data?.['fallback']).toBe(true);
    });

    it('returns fallback when target agent is not registered', async () => {
      // No agents registered
      const { decision } = await service.delegate(
        makeMessage(),
        makeClassification('growth'),
        makeContext(),
      );

      expect(decision.isFallback).toBe(true);
    });

    it('returns fallback when target agent is registered but unavailable', async () => {
      const unavailableAgent = makeAgent('research', false); // unavailable
      service.registerAgent(unavailableAgent);

      const { decision } = await service.delegate(
        makeMessage(),
        makeClassification('research'),
        makeContext(),
      );

      expect(decision.isFallback).toBe(true);
      expect(unavailableAgent.handle).not.toHaveBeenCalled();
    });

    it('fallback response content contains guidance text', async () => {
      const { response } = await service.delegate(
        makeMessage(),
        makeClassification('unknown', 0),
        makeContext(),
      );

      expect(response.content).toMatch(/Comms Agent|Finance Agent|Ops Agent/);
    });
  });

  describe('delegate — decision metadata', () => {
    it('includes the original classification in the routing decision', async () => {
      service.registerAgent(makeAgent('erp'));
      const classification = makeClassification('erp', 0.87);

      const { decision } = await service.delegate(
        makeMessage(),
        classification,
        makeContext(),
      );

      expect(decision.classification).toEqual(classification);
    });

    it('sets a decidedAt ISO timestamp', async () => {
      service.registerAgent(makeAgent('builder'));
      const { decision } = await service.delegate(
        makeMessage(),
        makeClassification('builder'),
        makeContext(),
      );

      expect(() => new Date(decision.decidedAt)).not.toThrow();
      expect(new Date(decision.decidedAt).getTime()).not.toBeNaN();
    });

    it('includes the original messageId in the routing decision', async () => {
      service.registerAgent(makeAgent('ops'));
      const message = makeMessage();

      const { decision } = await service.delegate(
        message,
        makeClassification('ops'),
        makeContext(),
      );

      expect(decision.messageId).toBe(message.id);
    });
  });
});
