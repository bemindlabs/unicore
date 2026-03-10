import { Test, TestingModule } from '@nestjs/testing';
import { MessageRouterService } from './message-router.service';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { AgentMetadata } from '../registry/interfaces/agent.interface';

const makeMetadata = (id: string): AgentMetadata => ({
  id,
  name: `Agent ${id}`,
  type: 'worker',
  version: '1.0.0',
  capabilities: [],
  tags: [],
});

describe('MessageRouterService', () => {
  let router: MessageRouterService;
  let registry: AgentRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessageRouterService, AgentRegistryService],
    }).compile();

    router = module.get<MessageRouterService>(MessageRouterService);
    registry = module.get<AgentRegistryService>(AgentRegistryService);
  });

  describe('subscribe / unsubscribe', () => {
    it('adds and removes subscribers', () => {
      router.subscribe('agent-1', 'ch:news');
      expect(router.getChannelSubscribers('ch:news')).toContain('agent-1');

      router.unsubscribe('agent-1', 'ch:news');
      expect(router.getChannelSubscribers('ch:news')).not.toContain('agent-1');
    });

    it('removes the channel when the last subscriber leaves', () => {
      router.subscribe('agent-1', 'lonely');
      router.unsubscribe('agent-1', 'lonely');
      expect(router.getAllChannels().map((c) => c.channel)).not.toContain('lonely');
    });
  });

  describe('unsubscribeAll', () => {
    it('removes an agent from all channels', () => {
      router.subscribe('agent-1', 'ch:a');
      router.subscribe('agent-1', 'ch:b');
      router.unsubscribeAll('agent-1');

      expect(router.getAgentSubscriptions('agent-1')).toHaveLength(0);
    });
  });

  describe('routeDirect', () => {
    it('delivers a message to the target agent socket', () => {
      registry.register(makeMetadata('agent-1'), 'socket-1');

      const sent: Array<{ socketId: string; data: string }> = [];
      router.routeDirect('agent-1', 'hello', (socketId, data) =>
        sent.push({ socketId, data }),
      );

      expect(sent).toHaveLength(1);
      expect(sent[0].socketId).toBe('socket-1');
      expect(sent[0].data).toBe('hello');
    });

    it('returns false when agent is not registered', () => {
      const result = router.routeDirect('ghost', 'hi', () => undefined);
      expect(result).toBe(false);
    });
  });

  describe('routeBroadcast', () => {
    it('delivers to all agents except the sender', () => {
      registry.register(makeMetadata('sender'), 's-sender');
      registry.register(makeMetadata('agent-2'), 's-2');
      registry.register(makeMetadata('agent-3'), 's-3');

      const sent: string[] = [];
      const count = router.routeBroadcast('sender', 'broadcast!', (socketId) =>
        sent.push(socketId),
      );

      expect(count).toBe(2);
      expect(sent).not.toContain('s-sender');
      expect(sent).toContain('s-2');
      expect(sent).toContain('s-3');
    });
  });

  describe('routePublish', () => {
    it('delivers only to channel subscribers (excluding publisher)', () => {
      registry.register(makeMetadata('publisher'), 's-pub');
      registry.register(makeMetadata('sub-1'), 's-sub1');
      registry.register(makeMetadata('sub-2'), 's-sub2');
      registry.register(makeMetadata('non-sub'), 's-nonsub');

      router.subscribe('sub-1', 'events');
      router.subscribe('sub-2', 'events');
      // publisher also subscribed but should not receive its own message
      router.subscribe('publisher', 'events');

      const sent: string[] = [];
      const count = router.routePublish('events', 'publisher', 'data', (socketId) =>
        sent.push(socketId),
      );

      expect(count).toBe(2);
      expect(sent).toContain('s-sub1');
      expect(sent).toContain('s-sub2');
      expect(sent).not.toContain('s-pub');
      expect(sent).not.toContain('s-nonsub');
    });

    it('returns 0 when no subscribers on channel', () => {
      registry.register(makeMetadata('pub'), 's-pub');
      const count = router.routePublish('empty-channel', 'pub', 'data', () => undefined);
      expect(count).toBe(0);
    });
  });

  describe('getAgentSubscriptions', () => {
    it('returns all channels an agent is subscribed to', () => {
      router.subscribe('agent-1', 'ch:x');
      router.subscribe('agent-1', 'ch:y');

      const subs = router.getAgentSubscriptions('agent-1');
      expect(subs).toContain('ch:x');
      expect(subs).toContain('ch:y');
      expect(subs).toHaveLength(2);
    });
  });
});
