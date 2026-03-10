import { Test, TestingModule } from '@nestjs/testing';
import { AgentRegistryService } from './agent-registry.service';
import { AgentMetadata } from './interfaces/agent.interface';

const makeMetadata = (overrides: Partial<AgentMetadata> = {}): AgentMetadata => ({
  id: 'agent-1',
  name: 'Test Agent',
  type: 'worker',
  version: '1.0.0',
  capabilities: [{ name: 'compute', version: '1.0' }],
  tags: ['test'],
  ...overrides,
});

describe('AgentRegistryService', () => {
  let service: AgentRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentRegistryService],
    }).compile();

    service = module.get<AgentRegistryService>(AgentRegistryService);
  });

  describe('register', () => {
    it('registers an agent and transitions to running state', () => {
      const metadata = makeMetadata();
      const agent = service.register(metadata, 'socket-1');

      expect(agent.metadata.id).toBe('agent-1');
      expect(agent.state).toBe('running');
      expect(agent.socketId).toBe('socket-1');
    });

    it('stores the agent and allows lookup by id', () => {
      service.register(makeMetadata(), 'socket-1');
      const found = service.getAgent('agent-1');
      expect(found).toBeDefined();
      expect(found?.metadata.name).toBe('Test Agent');
    });

    it('allows lookup by socketId', () => {
      service.register(makeMetadata(), 'socket-abc');
      const found = service.getAgentBySocket('socket-abc');
      expect(found?.metadata.id).toBe('agent-1');
    });
  });

  describe('unregister', () => {
    it('removes a registered agent', () => {
      service.register(makeMetadata(), 'socket-1');
      const ok = service.unregister('agent-1');
      expect(ok).toBe(true);
      expect(service.getAgent('agent-1')).toBeUndefined();
    });

    it('returns false for unknown agentId', () => {
      const ok = service.unregister('non-existent');
      expect(ok).toBe(false);
    });

    it('clears the socketId mapping', () => {
      service.register(makeMetadata(), 'socket-1');
      service.unregister('agent-1');
      expect(service.getAgentBySocket('socket-1')).toBeUndefined();
    });
  });

  describe('unregisterBySocket', () => {
    it('removes agent associated with the given socketId', () => {
      service.register(makeMetadata(), 'socket-x');
      const agent = service.unregisterBySocket('socket-x');
      expect(agent?.metadata.id).toBe('agent-1');
      expect(service.getAgent('agent-1')).toBeUndefined();
    });

    it('returns undefined for unknown socketId', () => {
      expect(service.unregisterBySocket('unknown-socket')).toBeUndefined();
    });
  });

  describe('updateState', () => {
    it('transitions agent state', () => {
      service.register(makeMetadata(), 'socket-1');
      service.updateState('agent-1', 'idle');
      expect(service.getAgent('agent-1')?.state).toBe('idle');
    });

    it('returns false for unknown agentId', () => {
      expect(service.updateState('ghost', 'idle')).toBe(false);
    });
  });

  describe('recordHeartbeat', () => {
    it('updates lastHeartbeatAt', async () => {
      service.register(makeMetadata(), 'socket-1');
      const before = service.getAgent('agent-1')!.lastHeartbeatAt;

      await new Promise((r) => setTimeout(r, 5));
      service.recordHeartbeat('agent-1');

      const after = service.getAgent('agent-1')!.lastHeartbeatAt;
      expect(after.getTime()).toBeGreaterThan(before.getTime());
    });

    it('returns false for unknown agentId', () => {
      expect(service.recordHeartbeat('nobody')).toBe(false);
    });
  });

  describe('findByCapability', () => {
    it('finds agents that have the requested capability', () => {
      service.register(makeMetadata({ id: 'a1', capabilities: [{ name: 'search', version: '1' }] }), 's1');
      service.register(makeMetadata({ id: 'a2', capabilities: [{ name: 'compute', version: '1' }] }), 's2');

      const results = service.findByCapability('search');
      expect(results.length).toBe(1);
      expect(results[0].metadata.id).toBe('a1');
    });
  });

  describe('findByType', () => {
    it('finds agents of the requested type', () => {
      service.register(makeMetadata({ id: 'a1', type: 'planner' }), 's1');
      service.register(makeMetadata({ id: 'a2', type: 'executor' }), 's2');

      expect(service.findByType('planner').length).toBe(1);
      expect(service.findByType('planner')[0].metadata.id).toBe('a1');
    });
  });

  describe('findByTag', () => {
    it('finds agents with the given tag', () => {
      service.register(makeMetadata({ id: 'a1', tags: ['alpha', 'beta'] }), 's1');
      service.register(makeMetadata({ id: 'a2', tags: ['gamma'] }), 's2');

      expect(service.findByTag('beta').map((a) => a.metadata.id)).toEqual(['a1']);
    });
  });

  describe('getStaleAgents', () => {
    it('returns agents whose heartbeat is older than the timeout', async () => {
      service.register(makeMetadata({ id: 'fresh' }), 's1');
      service.register(makeMetadata({ id: 'stale' }), 's2');

      // Manually backdate the stale agent
      const staleAgent = service.getAgent('stale')!;
      staleAgent.lastHeartbeatAt = new Date(Date.now() - 200_000);

      const results = service.getStaleAgents(90_000);
      expect(results.map((a) => a.metadata.id)).toContain('stale');
      expect(results.map((a) => a.metadata.id)).not.toContain('fresh');
    });
  });

  describe('getSummary', () => {
    it('returns total count and state breakdown', () => {
      service.register(makeMetadata({ id: 'a1' }), 's1');
      service.register(makeMetadata({ id: 'a2' }), 's2');
      service.updateState('a2', 'idle');

      const summary = service.getSummary();
      expect(summary.total).toBe(2);
      expect(summary.byState.running).toBe(1);
      expect(summary.byState.idle).toBe(1);
    });
  });
});
