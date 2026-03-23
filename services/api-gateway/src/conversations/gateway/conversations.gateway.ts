import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';

/**
 * ConversationsGateway — real-time WebSocket gateway for conversation events.
 *
 * Runs on port 4001 (separate from the REST server on 4000) to avoid
 * conflicts with the Express HTTP server.
 *
 * Clients connect with: ws://unicore-api-gateway:4001
 *
 * Emitted events:
 *   - conversation.created  { conversation }
 *   - conversation.updated  { conversation }
 *   - message.inbound       { message, conversationId }
 *   - conversation.assigned { conversationId, agentId }
 *   - conversation.closed   { conversationId }
 */
@WebSocketGateway({ port: 4001, path: '/conversations' })
export class ConversationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ConversationsGateway.name);

  @WebSocketServer()
  server!: Server;

  afterInit(): void {
    this.logger.log('ConversationsGateway initialised on port 4001');
  }

  handleConnection(client: WebSocket): void {
    this.logger.debug(`WS client connected (total: ${this.server.clients.size})`);
    // Send welcome ping
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event: 'connected', data: { ts: Date.now() } }));
    }
  }

  handleDisconnect(): void {
    this.logger.debug(`WS client disconnected (total: ${this.server.clients.size})`);
  }

  // ─── Broadcast helpers ────────────────────────────────────────────────────

  emit(event: string, data: unknown): void {
    if (!this.server) return;
    const payload = JSON.stringify({ event, data });
    for (const client of this.server.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  emitConversationCreated(conversation: Record<string, unknown>): void {
    this.emit('conversation.created', { conversation });
  }

  emitConversationUpdated(conversation: Record<string, unknown>): void {
    this.emit('conversation.updated', { conversation });
  }

  emitMessageInbound(conversationId: string, message: Record<string, unknown>): void {
    this.emit('message.inbound', { conversationId, message });
  }

  emitConversationAssigned(conversationId: string, agentId: string): void {
    this.emit('conversation.assigned', { conversationId, agentId });
  }

  emitConversationClosed(conversationId: string): void {
    this.emit('conversation.closed', { conversationId });
  }
}
