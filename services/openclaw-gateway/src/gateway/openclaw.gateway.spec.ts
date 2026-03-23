import { Test, TestingModule } from '@nestjs/testing';
import { OpenClawGateway } from './openclaw.gateway';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { MessageRouterService } from '../routing/message-router.service';
import { HeartbeatService } from '../health/heartbeat.service';
import {
  RegisterMessage,
  HeartbeatMessage,
  DirectMessage,
  BroadcastMessage,
  PublishMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  PingMessage,
  StateChangeMessage,
  UnregisterMessage,
} from '../routing/interfaces/message.interface';
import { RouterAgent } from '../router/router.agent';
import { PtySessionManager } from '../terminal/pty-session-manager';
import { MessagePersistenceService } from '../persistence/message-persistence.service';
import { RateLimiterService } from '../routing/rate-limiter.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { HandoffNotifierService } = require('../handoff/handoff-notifier.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ConversationService } = require('../conversations/conversation.service');
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

interface TrackedSocket extends WebSocket {
  socketId: string;
}

const makeSocket = (socketId = 'test-socket'): TrackedSocket => {
  const socket = {
    socketId,
    readyState: WebSocket.OPEN,
    send: jest.fn(),
  } as unknown as TrackedSocket;
  return socket;
};

const baseMsg = () => ({
  messageId: uuidv4(),
  timestamp: new Date().toISOString(),
});

describe('OpenClawGateway', () => {
  let gateway: OpenClawGateway;
  let registry: AgentRegistryService;
  let router: MessageRouterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenClawGateway,
        AgentRegistryService,
        MessageRouterService,
        {
          provide: HeartbeatService,
          useValue: {
            setSendFunction: jest.fn(),
            onModuleInit: jest.fn(),
            onModuleDestroy: jest.fn(),
            getStatus: jest.fn().mockReturnValue({}),
          },
        },
        {
          provide: RouterAgent,
          useValue: { process: jest.fn() },
        },
        {
          provide: PtySessionManager,
          useValue: {
            setSendFunction: jest.fn(),
            createSession: jest.fn(),
            writeInput: jest.fn(),
            resize: jest.fn(),
            destroySession: jest.fn(),
            destroyAllForSocket: jest.fn(),
            onModuleDestroy: jest.fn(),
          },
        },
        {
          provide: RateLimiterService,
          useValue: {
            checkAgentLimit: jest.fn().mockReturnValue({ allowed: true }),
            checkChannelLimit: jest.fn().mockReturnValue({ allowed: true }),
          },
        },
        {
          provide: MessagePersistenceService,
          useValue: {
            save: jest.fn().mockResolvedValue(undefined),
            findByChannel: jest.fn().mockResolvedValue([]),
            findAfterMessageId: jest.fn().mockResolvedValue([]),
            onModuleInit: jest.fn(),
            onModuleDestroy: jest.fn(),
          },
        },
        {
          provide: HandoffNotifierService,
          useValue: {
            detectTrigger: jest.fn().mockReturnValue(null),
            createHandoff: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ConversationService,
          useValue: {
            create: jest.fn().mockResolvedValue({}),
            assign: jest.fn().mockResolvedValue({}),
            findByAgent: jest.fn().mockResolvedValue([]),
            findById: jest.fn().mockResolvedValue(null),
            onModuleInit: jest.fn(),
            onModuleDestroy: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<OpenClawGateway>(OpenClawGateway);
    registry = module.get<AgentRegistryService>(AgentRegistryService);
    router = module.get<MessageRouterService>(MessageRouterService);

    // Stub the WS server with a no-op clients set
    (gateway as unknown as { server: { clients: Set<WebSocket> } }).server = {
      clients: new Set<WebSocket>(),
    };
  });

  describe('handleRegister', () => {
    it('registers an agent and sends ack', () => {
      const socket = makeSocket();
      const msg: RegisterMessage = {
        ...baseMsg(),
        type: 'agent:register',
        payload: {
          agentId: 'a1',
          name: 'Alpha',
          agentType: 'planner',
          version: '1.0.0',
          capabilities: [{ name: 'plan', version: '1' }],
          tags: ['core'],
        },
      };

      gateway.handleRegister(socket as unknown as WebSocket, msg);

      expect(socket.send).toHaveBeenCalledTimes(1);
      const response = JSON.parse((socket.send as jest.Mock).mock.calls[0][0]);
      expect(response.type).toBe('system:ack');
      expect(response.payload.result.agentId).toBe('a1');
      expect(registry.getAgent('a1')).toBeDefined();
    });
  });

  describe('handleUnregister', () => {
    it('unregisters a known agent and sends ack', () => {
      const socket = makeSocket();
      registry.register({ id: 'a1', name: 'A', type: 'w', version: '1', capabilities: [] }, 'test-socket');

      const msg: UnregisterMessage = {
        ...baseMsg(),
        type: 'agent:unregister',
        payload: { agentId: 'a1', reason: 'done' },
      };

      gateway.handleUnregister(socket as unknown as WebSocket, msg);

      const response = JSON.parse((socket.send as jest.Mock).mock.calls[0][0]);
      expect(response.type).toBe('system:ack');
      expect(registry.getAgent('a1')).toBeUndefined();
    });

    it('sends error for unknown agent', () => {
      const socket = makeSocket();
      const msg: UnregisterMessage = {
        ...baseMsg(),
        type: 'agent:unregister',
        payload: { agentId: 'ghost' },
      };

      gateway.handleUnregister(socket as unknown as WebSocket, msg);

      const response = JSON.parse((socket.send as jest.Mock).mock.calls[0][0]);
      expect(response.type).toBe('system:error');
      expect(response.payload.code).toBe('AGENT_NOT_FOUND');
    });
  });

  describe('handleHeartbeat', () => {
    it('records heartbeat and acks', () => {
      const socket = makeSocket();
      registry.register({ id: 'a1', name: 'A', type: 'w', version: '1', capabilities: [] }, 'test-socket');

      const msg: HeartbeatMessage = {
        ...baseMsg(),
        type: 'agent:heartbeat',
        payload: { agentId: 'a1' },
      };

      gateway.handleHeartbeat(socket as unknown as WebSocket, msg);

      const response = JSON.parse((socket.send as jest.Mock).mock.calls[0][0]);
      expect(response.type).toBe('system:ack');
    });

    it('sends error for unknown agent', () => {
      const socket = makeSocket();
      const msg: HeartbeatMessage = {
        ...baseMsg(),
        type: 'agent:heartbeat',
        payload: { agentId: 'ghost' },
      };

      gateway.handleHeartbeat(socket as unknown as WebSocket, msg);

      const response = JSON.parse((socket.send as jest.Mock).mock.calls[0][0]);
      expect(response.type).toBe('system:error');
    });
  });

  describe('handleStateChange', () => {
    it('updates agent state and acks', () => {
      const socket = makeSocket();
      registry.register({ id: 'a1', name: 'A', type: 'w', version: '1', capabilities: [] }, 'test-socket');

      const msg: StateChangeMessage = {
        ...baseMsg(),
        type: 'agent:state',
        payload: { agentId: 'a1', state: 'idle' },
      };

      gateway.handleStateChange(socket as unknown as WebSocket, msg);

      const response = JSON.parse((socket.send as jest.Mock).mock.calls[0][0]);
      expect(response.type).toBe('system:ack');
      expect(registry.getAgent('a1')?.state).toBe('idle');
    });
  });

  describe('handleDirect', () => {
    it('routes direct message and acks sender', () => {
      const senderSocket = makeSocket('socket-sender');
      const recipientSocket = makeSocket('socket-recipient');

      registry.register({ id: 'sender', name: 'S', type: 'w', version: '1', capabilities: [] }, 'socket-sender');
      registry.register({ id: 'recipient', name: 'R', type: 'w', version: '1', capabilities: [] }, 'socket-recipient');

      // Add recipient socket to the server's clients set
      const serverClients = (gateway as unknown as { server: { clients: Set<WebSocket> } }).server.clients;
      serverClients.add(recipientSocket as unknown as WebSocket);

      const msg: DirectMessage = {
        ...baseMsg(),
        type: 'message:direct',
        payload: {
          fromAgentId: 'sender',
          toAgentId: 'recipient',
          topic: 'task',
          data: { work: true },
        },
      };

      gateway.handleDirect(senderSocket as unknown as WebSocket, msg);

      const ack = JSON.parse((senderSocket.send as jest.Mock).mock.calls[0][0]);
      expect(ack.type).toBe('system:ack');
      expect(ack.payload.result.delivered).toBe(true);

      expect(recipientSocket.send).toHaveBeenCalledTimes(1);
    });

    it('sends error when recipient not available', () => {
      const senderSocket = makeSocket('socket-sender');
      registry.register({ id: 'sender', name: 'S', type: 'w', version: '1', capabilities: [] }, 'socket-sender');

      const msg: DirectMessage = {
        ...baseMsg(),
        type: 'message:direct',
        payload: {
          fromAgentId: 'sender',
          toAgentId: 'nobody',
          topic: 'task',
          data: {},
        },
      };

      gateway.handleDirect(senderSocket as unknown as WebSocket, msg);

      const response = JSON.parse((senderSocket.send as jest.Mock).mock.calls[0][0]);
      expect(response.type).toBe('system:error');
      expect(response.payload.code).toBe('AGENT_UNAVAILABLE');
    });
  });

  describe('handleBroadcast', () => {
    it('broadcasts to all other agents and acks', () => {
      const senderSocket = makeSocket('socket-s');
      const otherSocket = makeSocket('socket-o');

      registry.register({ id: 'sender', name: 'S', type: 'w', version: '1', capabilities: [] }, 'socket-s');
      registry.register({ id: 'other', name: 'O', type: 'w', version: '1', capabilities: [] }, 'socket-o');

      const serverClients = (gateway as unknown as { server: { clients: Set<WebSocket> } }).server.clients;
      serverClients.add(otherSocket as unknown as WebSocket);

      const msg: BroadcastMessage = {
        ...baseMsg(),
        type: 'message:broadcast',
        payload: { fromAgentId: 'sender', topic: 'update', data: {} },
      };

      gateway.handleBroadcast(senderSocket as unknown as WebSocket, msg);

      const ack = JSON.parse((senderSocket.send as jest.Mock).mock.calls[0][0]);
      expect(ack.type).toBe('system:ack');
      expect(ack.payload.result.deliveredTo).toBe(1);
    });
  });

  describe('handlePublish', () => {
    it('publishes to subscribed agents and acks', () => {
      const pubSocket = makeSocket('socket-pub');
      const subSocket = makeSocket('socket-sub');

      registry.register({ id: 'pub', name: 'P', type: 'w', version: '1', capabilities: [] }, 'socket-pub');
      registry.register({ id: 'sub', name: 'S', type: 'w', version: '1', capabilities: [] }, 'socket-sub');

      router.subscribe('sub', 'alerts');

      const serverClients = (gateway as unknown as { server: { clients: Set<WebSocket> } }).server.clients;
      serverClients.add(subSocket as unknown as WebSocket);

      const msg: PublishMessage = {
        ...baseMsg(),
        type: 'message:publish',
        payload: { fromAgentId: 'pub', channel: 'alerts', data: { level: 'info' } },
      };

      gateway.handlePublish(pubSocket as unknown as WebSocket, msg);

      const ack = JSON.parse((pubSocket.send as jest.Mock).mock.calls[0][0]);
      expect(ack.type).toBe('system:ack');
      expect(ack.payload.result.deliveredTo).toBe(1);
      expect(subSocket.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleSubscribe / handleUnsubscribe', () => {
    it('subscribes an agent to a channel', () => {
      const socket = makeSocket();
      const msg: SubscribeMessage = {
        ...baseMsg(),
        type: 'message:subscribe',
        payload: { agentId: 'a1', channel: 'news' },
      };

      gateway.handleSubscribe(socket as unknown as WebSocket, msg);

      expect(router.getChannelSubscribers('news')).toContain('a1');
      const ack = JSON.parse((socket.send as jest.Mock).mock.calls[0][0]);
      expect(ack.type).toBe('system:ack');
    });

    it('unsubscribes an agent from a channel', () => {
      const socket = makeSocket();
      router.subscribe('a1', 'news');

      const msg: UnsubscribeMessage = {
        ...baseMsg(),
        type: 'message:unsubscribe',
        payload: { agentId: 'a1', channel: 'news' },
      };

      gateway.handleUnsubscribe(socket as unknown as WebSocket, msg);

      expect(router.getChannelSubscribers('news')).not.toContain('a1');
    });
  });

  describe('handlePing', () => {
    it('responds with pong', () => {
      const socket = makeSocket();
      const msg: PingMessage = {
        ...baseMsg(),
        type: 'system:ping',
      };

      gateway.handlePing(socket as unknown as WebSocket, msg);

      const response = JSON.parse((socket.send as jest.Mock).mock.calls[0][0]);
      expect(response.type).toBe('system:pong');
      expect(response.payload.originalMessageId).toBe(msg.messageId);
    });
  });

  describe('handleDisconnect', () => {
    it('auto-unregisters the agent and cleans up subscriptions', () => {
      const socket = makeSocket('socket-gone');
      registry.register({ id: 'a1', name: 'A', type: 'w', version: '1', capabilities: [] }, 'socket-gone');
      router.subscribe('a1', 'channel-x');

      gateway.handleDisconnect(socket as unknown as WebSocket);

      expect(registry.getAgent('a1')).toBeUndefined();
      expect(router.getChannelSubscribers('channel-x')).not.toContain('a1');
    });
  });

  describe('handleSubscribe — reconnect replay', () => {
    it('sends ack and does not call replay when no lastMessageId', () => {
      const socket = makeSocket();
      const persistence = gateway['persistence'] as jest.Mocked<MessagePersistenceService>;

      const msg: SubscribeMessage = {
        ...baseMsg(),
        type: 'message:subscribe',
        payload: { agentId: 'a1', channel: 'chat-backoffice' },
      };

      gateway.handleSubscribe(socket as unknown as WebSocket, msg);

      const ack = JSON.parse((socket.send as jest.Mock).mock.calls[0][0]);
      expect(ack.type).toBe('system:ack');
      expect(persistence.findAfterMessageId).not.toHaveBeenCalled();
    });

    it('triggers replay when lastMessageId is provided', async () => {
      const socket = makeSocket();
      const persistence = gateway['persistence'] as jest.Mocked<MessagePersistenceService>;

      const missed = [
        { id: '1', messageId: 'old-msg-1', channel: 'chat-backoffice', fromAgentId: 'agent-comms', data: { text: 'Hi' }, createdAt: new Date() },
        { id: '2', messageId: 'old-msg-2', channel: 'chat-backoffice', fromAgentId: 'agent-comms', data: { text: 'There' }, createdAt: new Date() },
      ];
      (persistence.findAfterMessageId as jest.Mock).mockResolvedValue(missed);

      const msg: SubscribeMessage = {
        ...baseMsg(),
        type: 'message:subscribe',
        payload: { agentId: 'a1', channel: 'chat-backoffice', lastMessageId: 'last-seen-id' },
      };

      gateway.handleSubscribe(socket as unknown as WebSocket, msg);

      // Wait for the async replay to complete
      await new Promise((r) => setTimeout(r, 10));

      expect(persistence.findAfterMessageId).toHaveBeenCalledWith('chat-backoffice', 'last-seen-id');
      // ack + 2 replayed messages = 3 sends
      expect((socket.send as jest.Mock).mock.calls).toHaveLength(3);
      const replayed = JSON.parse((socket.send as jest.Mock).mock.calls[1][0]);
      expect(replayed.type).toBe('message:publish');
      expect(replayed.payload.replay).toBe(true);
      expect(replayed.payload.originalMessageId).toBe('old-msg-1');
    });
  });

  describe('handlePublish — message persistence', () => {
    it('persists the message after routing', () => {
      const pubSocket = makeSocket('socket-pub');
      registry.register({ id: 'pub', name: 'P', type: 'w', version: '1', capabilities: [] }, 'socket-pub');
      const persistence = gateway['persistence'] as jest.Mocked<MessagePersistenceService>;

      const msg: PublishMessage = {
        ...baseMsg(),
        type: 'message:publish',
        payload: { fromAgentId: 'pub', channel: 'alerts', data: { level: 'info' } },
      };

      gateway.handlePublish(pubSocket as unknown as WebSocket, msg);

      expect(persistence.save).toHaveBeenCalledWith(
        msg.messageId,
        'alerts',
        'pub',
        { level: 'info' },
      );
    });
  });
});
