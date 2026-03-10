import { Test, TestingModule } from '@nestjs/testing';
import { HeartbeatService } from './heartbeat.service';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { MessageRouterService } from '../routing/message-router.service';

describe('HeartbeatService', () => {
  let service: HeartbeatService;
  let registry: AgentRegistryService;

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [HeartbeatService, AgentRegistryService, MessageRouterService],
    }).compile();

    service = module.get<HeartbeatService>(HeartbeatService);
    registry = module.get<AgentRegistryService>(AgentRegistryService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('onModuleInit / onModuleDestroy', () => {
    it('starts the interval on init', () => {
      service.onModuleInit();
      expect(service.getStatus().running).toBe(true);
    });

    it('stops the interval on destroy', () => {
      service.onModuleInit();
      service.onModuleDestroy();
      expect(service.getStatus().running).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('returns configuration values', () => {
      const status = service.getStatus();
      expect(status.heartbeatIntervalMs).toBeGreaterThan(0);
      expect(status.heartbeatTimeoutMs).toBeGreaterThan(0);
    });
  });

  describe('stale agent eviction', () => {
    it('marks stale agents as terminated after timeout', () => {
      registry.register(
        {
          id: 'stale-agent',
          name: 'Stale',
          type: 'worker',
          version: '1.0.0',
          capabilities: [],
        },
        'socket-stale',
      );

      // Backdate the heartbeat
      const agent = registry.getAgent('stale-agent')!;
      agent.lastHeartbeatAt = new Date(Date.now() - 200_000);

      service.onModuleInit();

      // Advance timers to trigger the first check
      jest.advanceTimersByTime(30_000 + 1);

      const terminated = registry.getAgent('stale-agent');
      // Agent remains in registry but is marked terminated
      expect(terminated?.state).toBe('terminated');
    });

    it('does not evict agents with fresh heartbeats', () => {
      registry.register(
        {
          id: 'fresh-agent',
          name: 'Fresh',
          type: 'worker',
          version: '1.0.0',
          capabilities: [],
        },
        'socket-fresh',
      );

      service.onModuleInit();
      jest.advanceTimersByTime(30_000 + 1);

      expect(registry.getAgent('fresh-agent')).toBeDefined();
    });
  });
});
