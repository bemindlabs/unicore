import { Logger, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import * as jwt from 'jsonwebtoken';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { MessageRouterService } from '../routing/message-router.service';
import { HeartbeatService } from '../health/heartbeat.service';
import { RouterAgent } from '../router/router.agent';
import { PtySessionManager } from '../terminal/pty-session-manager';
import {
  IncomingMessage,
  OutgoingMessage,
  AckMessage,
  ErrorMessage,
  PongMessage,
  PtyMessage,
} from '../routing/interfaces/message.interface';
import { AgentMetadata } from '../registry/interfaces/agent.interface';

// Extend the WebSocket type to carry our correlation id and auth context
interface TrackedSocket extends WebSocket {
  socketId: string;
  userId?: string;
  authenticated: boolean;
}

/** Allowed internal service tokens (agents connecting from backend services). */
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET ?? '';
const JWT_SECRET = process.env.JWT_SECRET ?? '';

@WebSocketGateway(18789, { path: '/', transports: ['websocket'] })
export class OpenClawGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(OpenClawGateway.name);

  @WebSocketServer()
  server!: Server;

  /** Chat channel prefixes that trigger the RouterAgent pipeline. */
  private static readonly CHAT_CHANNEL_PREFIXES = ['chat-agent-', 'command-', 'chat-backoffice'];

  constructor(
    private readonly registry: AgentRegistryService,
    private readonly router: MessageRouterService,
    private readonly heartbeat: HeartbeatService,
    private readonly routerAgent: RouterAgent,
    private readonly ptyManager: PtySessionManager,
  ) {}

  onModuleInit(): void {
    // Wire the heartbeat service with a send function after init
    this.heartbeat.setSendFunction((socketId: string, data: string) => {
      this.sendToSocket(socketId, data);
    });
    this.ptyManager.setSendFunction((socketId: string, data: string) => {
      this.sendToSocket(socketId, data);
    });
  }

  afterInit(server: Server): void {
    this.logger.log('OpenClaw Gateway WebSocket server initialised on port 18789');
    // Tag each new socket with a unique id
    server.on('connection', (socket: WebSocket, req: import('http').IncomingMessage) => {
      const tracked = socket as TrackedSocket;
      tracked.socketId = uuidv4();
      tracked.authenticated = false;

      // Authenticate via query params or Authorization header
      try {
        const url = new URL(req.url ?? '/', 'http://localhost');

        // Option 1: Internal service token (backend-to-backend)
        const serviceToken = url.searchParams.get('serviceToken')
          ?? req.headers['x-internal-service'] as string | undefined;
        if (serviceToken && INTERNAL_SERVICE_SECRET && serviceToken === INTERNAL_SERVICE_SECRET) {
          tracked.authenticated = true;
          tracked.userId = 'internal-service';
          return;
        }

        // Option 2: JWT Bearer token
        const token = url.searchParams.get('token')
          ?? (req.headers['authorization']?.startsWith('Bearer ')
            ? req.headers['authorization'].slice(7)
            : undefined);

        if (token && JWT_SECRET) {
          const payload = jwt.verify(token, JWT_SECRET) as { sub?: string };
          if (payload.sub) {
            tracked.authenticated = true;
            tracked.userId = payload.sub;
            return;
          }
        }
      } catch {
        // JWT verification failed — reject below
      }

      // If no JWT_SECRET configured (dev mode), allow unauthenticated connections
      if (!JWT_SECRET) {
        tracked.authenticated = true;
        tracked.userId = 'dev-user';
        return;
      }

      // Reject unauthenticated connections
      tracked.authenticated = false;
      socket.close(4401, 'Authentication required');
    });

    // Raw message handler — the NestJS WsAdapter expects { event, data } format
    // but our protocol uses { type, ... }. Wire up manual dispatch.
    server.on('connection', (socket: WebSocket) => {
      socket.on('message', (raw: Buffer | string) => {
        try {
          const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString()) as IncomingMessage;
          if (!msg?.type) return;
          switch (msg.type) {
            case 'agent:register':     this.handleRegister(socket, msg); break;
            case 'agent:unregister':   this.handleUnregister(socket, msg); break;
            case 'agent:heartbeat':    this.handleHeartbeat(socket, msg); break;
            case 'agent:state':        this.handleStateChange(socket, msg); break;
            case 'message:direct':     this.handleDirect(socket, msg); break;
            case 'message:broadcast':  this.handleBroadcast(socket, msg); break;
            case 'message:publish':    this.handlePublish(socket, msg); break;
            case 'message:subscribe':  this.handleSubscribe(socket, msg); break;
            case 'message:unsubscribe': this.handleUnsubscribe(socket, msg); break;
            case 'system:ping':        this.handlePing(socket, msg); break;
            case 'pty:create':         this.handlePtyCreate(socket, msg); break;
            case 'pty:input':          this.handlePtyInput(socket, msg); break;
            case 'pty:resize':         this.handlePtyResize(socket, msg); break;
            case 'pty:destroy':        this.handlePtyDestroy(socket, msg); break;
            default:
              socket.send(JSON.stringify({
                type: 'system:error',
                payload: { code: 'UNKNOWN_TYPE', message: `Unknown message type: ${(msg as { type: string }).type}` },
              }));
          }
        } catch {
          // Ignore malformed messages
        }
      });
    });
  }

  handleConnection(client: WebSocket): void {
    const socket = client as TrackedSocket;
    if (!socket.authenticated) return; // Already closed in afterInit
    this.logger.log(`Client connected: ${socket.socketId} (user: ${socket.userId})`);
  }

  handleDisconnect(client: WebSocket): void {
    const socket = client as TrackedSocket;
    this.logger.log(`Client disconnected: ${socket.socketId}`);

    this.ptyManager.destroyAllForSocket(socket.socketId);

    const agent = this.registry.unregisterBySocket(socket.socketId);
    if (agent) {
      this.router.unsubscribeAll(agent.metadata.id);
      this.logger.log(
        `Agent ${agent.metadata.id} auto-unregistered on disconnect`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Message handlers
  // ---------------------------------------------------------------------------

  @SubscribeMessage('agent:register')
  handleRegister(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() message: IncomingMessage,
  ): void {
    const socket = client as TrackedSocket;
    if (message.type !== 'agent:register') return;

    const { payload } = message;
    const metadata: AgentMetadata = {
      id: payload.agentId,
      name: payload.name,
      type: payload.agentType,
      version: payload.version,
      capabilities: payload.capabilities,
      tags: payload.tags,
    };

    try {
      const agent = this.registry.register(metadata, socket.socketId);
      this.send(client, this.ack(message.messageId, { agentId: agent.metadata.id, state: agent.state }));
    } catch (err) {
      this.logger.error(`Registration failed for ${payload.agentId}: ${String(err)}`);
      this.send(client, this.error(message.messageId, 'REGISTRATION_FAILED', String(err)));
    }
  }

  @SubscribeMessage('agent:unregister')
  handleUnregister(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() message: IncomingMessage,
  ): void {
    if (message.type !== 'agent:unregister') return;

    const { agentId, reason } = message.payload;
    const ok = this.registry.unregister(agentId, reason);

    if (ok) {
      this.router.unsubscribeAll(agentId);
      this.send(client, this.ack(message.messageId, { agentId }));
    } else {
      this.send(client, this.error(message.messageId, 'AGENT_NOT_FOUND', `Agent ${agentId} not registered`));
    }
  }

  @SubscribeMessage('agent:heartbeat')
  handleHeartbeat(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() message: IncomingMessage,
  ): void {
    if (message.type !== 'agent:heartbeat') return;

    const { agentId } = message.payload;
    const ok = this.registry.recordHeartbeat(agentId);

    if (ok) {
      this.send(client, this.ack(message.messageId, { agentId }));
    } else {
      this.send(client, this.error(message.messageId, 'AGENT_NOT_FOUND', `Agent ${agentId} not registered`));
    }
  }

  @SubscribeMessage('agent:state')
  handleStateChange(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() message: IncomingMessage,
  ): void {
    if (message.type !== 'agent:state') return;

    const { agentId, state } = message.payload;
    const ok = this.registry.updateState(agentId, state);

    if (ok) {
      this.send(client, this.ack(message.messageId, { agentId, state }));
    } else {
      this.send(client, this.error(message.messageId, 'AGENT_NOT_FOUND', `Agent ${agentId} not registered`));
    }
  }

  @SubscribeMessage('message:direct')
  handleDirect(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() message: IncomingMessage,
  ): void {
    if (message.type !== 'message:direct') return;

    const envelope = JSON.stringify(message);
    const delivered = this.router.routeDirect(
      message.payload.toAgentId,
      envelope,
      (socketId, data) => this.sendToSocket(socketId, data),
    );

    if (delivered) {
      this.send(client, this.ack(message.messageId, { delivered: true }));
    } else {
      this.send(
        client,
        this.error(
          message.messageId,
          'AGENT_UNAVAILABLE',
          `Agent ${message.payload.toAgentId} not available`,
        ),
      );
    }
  }

  @SubscribeMessage('message:broadcast')
  handleBroadcast(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() message: IncomingMessage,
  ): void {
    if (message.type !== 'message:broadcast') return;

    const envelope = JSON.stringify(message);
    const count = this.router.routeBroadcast(
      message.payload.fromAgentId,
      envelope,
      (socketId, data) => this.sendToSocket(socketId, data),
    );

    this.send(client, this.ack(message.messageId, { deliveredTo: count }));
  }

  @SubscribeMessage('message:publish')
  handlePublish(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() message: IncomingMessage,
  ): void {
    if (message.type !== 'message:publish') return;

    const envelope = JSON.stringify(message);
    const count = this.router.routePublish(
      message.payload.channel,
      message.payload.fromAgentId,
      envelope,
      (socketId, data) => this.sendToSocket(socketId, data),
    );

    this.send(client, this.ack(message.messageId, { channel: message.payload.channel, deliveredTo: count }));

    // Bridge: if this is a user chat message on a chat/command channel,
    // invoke the RouterAgent pipeline and publish the AI response back.
    const channel = message.payload.channel;
    const fromAgent = message.payload.fromAgentId;
    const isChatChannel = OpenClawGateway.CHAT_CHANNEL_PREFIXES.some((p) => channel.startsWith(p));

    if (isChatChannel && fromAgent === 'dashboard-ui') {
      const text = (message.payload.data as Record<string, unknown>)?.text;
      if (typeof text === 'string' && text.trim()) {
        const tracked = client as TrackedSocket;
        const sessionId = channel; // use channel as session for conversation continuity
        const userId = tracked.userId ?? 'anonymous';

        this.processChat(text, sessionId, userId, channel).catch((err) => {
          this.logger.error(`Chat processing failed: ${err instanceof Error ? err.message : err}`);
        });
      }
    }
  }

  /**
   * Process a chat message through the RouterAgent and publish the response
   * back to the originating channel so the dashboard receives it.
   */
  private async processChat(
    text: string,
    sessionId: string,
    userId: string,
    channel: string,
  ): Promise<void> {
    const result = await this.routerAgent.process(text, sessionId, userId);

    const responseMessage: IncomingMessage = {
      type: 'message:publish',
      messageId: uuidv4(),
      timestamp: new Date().toISOString(),
      payload: {
        fromAgentId: result.decision.targetAgent ?? 'router',
        channel,
        data: {
          id: uuidv4(),
          text: result.response.content,
          author: result.decision.targetAgent
            ? `${result.decision.targetAgent.charAt(0).toUpperCase()}${result.decision.targetAgent.slice(1)} Agent`
            : 'Router Agent',
          authorId: result.decision.targetAgent ?? 'router',
          authorType: 'agent',
          channel,
          timestamp: new Date().toISOString(),
          metadata: {
            processingTimeMs: result.processingTimeMs,
            intent: result.decision.classification?.intent,
            confidence: result.decision.classification?.confidence,
          },
        },
      },
    };

    // Publish response to all channel subscribers (including the sender)
    const envelope = JSON.stringify(responseMessage);
    this.router.routePublish(
      channel,
      responseMessage.payload.fromAgentId,
      envelope,
      (socketId, data) => this.sendToSocket(socketId, data),
    );
  }

  @SubscribeMessage('message:subscribe')
  handleSubscribe(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() message: IncomingMessage,
  ): void {
    if (message.type !== 'message:subscribe') return;

    const { agentId, channel } = message.payload;
    const tracked = client as TrackedSocket;
    this.router.subscribe(agentId, channel, tracked.socketId);
    this.send(client, this.ack(message.messageId, { agentId, channel }));
  }

  @SubscribeMessage('message:unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() message: IncomingMessage,
  ): void {
    if (message.type !== 'message:unsubscribe') return;

    const { agentId, channel } = message.payload;
    this.router.unsubscribe(agentId, channel);
    this.send(client, this.ack(message.messageId, { agentId, channel }));
  }

  @SubscribeMessage('system:ping')
  handlePing(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() message: IncomingMessage,
  ): void {
    if (message.type !== 'system:ping') return;

    const pong: PongMessage = {
      type: 'system:pong',
      messageId: uuidv4(),
      timestamp: new Date().toISOString(),
      payload: {
        originalMessageId: message.messageId,
        timestamp: new Date().toISOString(),
      },
    };
    this.send(client, pong);
  }

  // ---------------------------------------------------------------------------
  // PTY terminal handlers
  // ---------------------------------------------------------------------------

  private handlePtyCreate(client: WebSocket, message: PtyMessage): void {
    const tracked = client as TrackedSocket;
    if (!tracked.authenticated) return;
    const { cols, rows, cwd } = message.payload as Record<string, any>;
    const sessionId = this.ptyManager.createSession(tracked.socketId, tracked.userId ?? 'anonymous', cols ?? 80, rows ?? 24, cwd);
    if (sessionId) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'pty:created', payload: { sessionId } }));
      }
    } else {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'system:error', payload: { code: 'PTY_CREATE_FAILED', message: 'Failed to create PTY session (limit reached or error)' } }));
      }
    }
  }

  private handlePtyInput(client: WebSocket, message: PtyMessage): void {
    const tracked = client as TrackedSocket;
    const { sessionId, data } = message.payload as Record<string, any>;
    if (sessionId && typeof data === 'string') {
      this.ptyManager.writeInput(sessionId, tracked.socketId, data);
    }
  }

  private handlePtyResize(client: WebSocket, message: PtyMessage): void {
    const tracked = client as TrackedSocket;
    const { sessionId, cols, rows } = message.payload as Record<string, any>;
    if (sessionId && cols && rows) {
      this.ptyManager.resize(sessionId, tracked.socketId, cols, rows);
    }
  }

  private handlePtyDestroy(client: WebSocket, message: PtyMessage): void {
    const tracked = client as TrackedSocket;
    const { sessionId } = message.payload as Record<string, any>;
    if (sessionId) {
      this.ptyManager.destroySession(sessionId, tracked.socketId);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private send(client: WebSocket, message: OutgoingMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  private sendToSocket(socketId: string, data: string): void {
    this.server.clients.forEach((ws) => {
      const socket = ws as TrackedSocket;
      if (socket.socketId === socketId && socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });
  }

  private ack(originalMessageId: string, result?: unknown): AckMessage {
    return {
      type: 'system:ack',
      messageId: uuidv4(),
      timestamp: new Date().toISOString(),
      payload: { originalMessageId, result },
    };
  }

  private error(
    originalMessageId: string | undefined,
    code: string,
    message: string,
  ): ErrorMessage {
    return {
      type: 'system:error',
      messageId: uuidv4(),
      timestamp: new Date().toISOString(),
      payload: { originalMessageId, code, message },
    };
  }
}
