import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';

interface ConversationSocket extends WebSocket {
  socketId: string;
  conversationIds: Set<string>;
}

/**
 * WebSocket gateway for real-time conversation updates.
 * Clients connect and subscribe to specific conversation rooms.
 *
 * Client → Server events:
 *   subscribe   { conversationId }  — join a conversation room
 *   unsubscribe { conversationId }  — leave a conversation room
 *
 * Server → Client events:
 *   message     { conversationId, message }   — new message in conversation
 *   update      { conversationId, changes }   — conversation status/assignment change
 */
@WebSocketGateway(4001, { path: '/ws/conversations', transports: ['websocket'] })
export class ConversationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ConversationsGateway.name);

  @WebSocketServer()
  server!: Server;

  /** conversationId → set of connected socketIds */
  private rooms = new Map<string, Set<string>>();
  /** socketId → socket instance */
  private sockets = new Map<string, ConversationSocket>();

  afterInit() {
    this.logger.log('Conversations WebSocket gateway initialized on port 4001');
  }

  handleConnection(socket: ConversationSocket) {
    socket.socketId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    socket.conversationIds = new Set();
    this.sockets.set(socket.socketId, socket);
    this.logger.debug(`Client connected: ${socket.socketId}`);
  }

  handleDisconnect(socket: ConversationSocket) {
    // Remove from all rooms
    for (const convId of socket.conversationIds) {
      const room = this.rooms.get(convId);
      if (room) {
        room.delete(socket.socketId);
        if (room.size === 0) this.rooms.delete(convId);
      }
    }
    this.sockets.delete(socket.socketId);
    this.logger.debug(`Client disconnected: ${socket.socketId}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() socket: ConversationSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const { conversationId } = data;
    if (!this.rooms.has(conversationId)) {
      this.rooms.set(conversationId, new Set());
    }
    this.rooms.get(conversationId)!.add(socket.socketId);
    socket.conversationIds.add(conversationId);
    this.logger.debug(`Socket ${socket.socketId} subscribed to ${conversationId}`);
    return { subscribed: true, conversationId };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() socket: ConversationSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const { conversationId } = data;
    this.rooms.get(conversationId)?.delete(socket.socketId);
    socket.conversationIds.delete(conversationId);
    return { unsubscribed: true, conversationId };
  }

  /** Broadcast a new message to all subscribers of a conversation */
  emitMessage(conversationId: string, message: any) {
    this.broadcast(conversationId, { event: 'message', conversationId, message });
  }

  /** Broadcast a conversation state change to all subscribers */
  emitConversationUpdate(conversationId: string, changes: Record<string, any>) {
    this.broadcast(conversationId, { event: 'update', conversationId, changes });
  }

  private broadcast(conversationId: string, payload: any) {
    const room = this.rooms.get(conversationId);
    if (!room || room.size === 0) return;
    const json = JSON.stringify(payload);
    for (const socketId of room) {
      const socket = this.sockets.get(socketId);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(json);
      }
    }
  }
}
