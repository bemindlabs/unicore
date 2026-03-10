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
import { AgentRegistryService } from '../registry/agent-registry.service';
import { MessageRouterService } from '../routing/message-router.service';
import { HeartbeatService } from '../health/heartbeat.service';
import {
  IncomingMessage,
  OutgoingMessage,
  AckMessage,
  ErrorMessage,
  PongMessage,
} from '../routing/interfaces/message.interface';
import { AgentMetadata } from '../registry/interfaces/agent.interface';

// Extend the WebSocket type to carry our correlation id
interface TrackedSocket extends WebSocket {
  socketId: string;
}

@WebSocketGateway(18789, { path: '/', transports: ['websocket'] })
export class OpenClawGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(OpenClawGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly registry: AgentRegistryService,
    private readonly router: MessageRouterService,
    private readonly heartbeat: HeartbeatService,
  ) {}

  onModuleInit(): void {
    // Wire the heartbeat service with a send function after init
    this.heartbeat.setSendFunction((socketId: string, data: string) => {
      this.sendToSocket(socketId, data);
    });
  }

  afterInit(server: Server): void {
    this.logger.log('OpenClaw Gateway WebSocket server initialised on port 18789');
    // Tag each new socket with a unique id
    server.on('connection', (socket: WebSocket) => {
      (socket as TrackedSocket).socketId = uuidv4();
    });
  }

  handleConnection(client: WebSocket): void {
    const socket = client as TrackedSocket;
    this.logger.log(`Client connected: ${socket.socketId}`);
  }

  handleDisconnect(client: WebSocket): void {
    const socket = client as TrackedSocket;
    this.logger.log(`Client disconnected: ${socket.socketId}`);

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
  }

  @SubscribeMessage('message:subscribe')
  handleSubscribe(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() message: IncomingMessage,
  ): void {
    if (message.type !== 'message:subscribe') return;

    const { agentId, channel } = message.payload;
    this.router.subscribe(agentId, channel);
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
