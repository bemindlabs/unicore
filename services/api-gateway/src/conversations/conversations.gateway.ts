import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * ConversationsGateway — real-time WebSocket gateway for conversation events.
 *
 * Namespace: /conversations (socket.io)
 *
 * Emitted events:
 *   - conversation:created       { conversation }
 *   - conversation:updated       { ...data }
 *   - conversation:status        { conversationId, status }
 *   - conversation:assigned      { conversationId, agentId }
 *   - conversation:message       { message }
 *   - participant:invited        { conversationId, participant }
 *   - participant:left           { conversationId, participantId }
 */
@WebSocketGateway({ namespace: '/conversations', cors: { origin: '*' } })
export class ConversationsGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('join')
  handleJoin(@MessageBody() conversationId: string, @ConnectedSocket() client: Socket): void {
    void client.join(`conv:${conversationId}`);
  }

  @SubscribeMessage('leave')
  handleLeave(@MessageBody() conversationId: string, @ConnectedSocket() client: Socket): void {
    void client.leave(`conv:${conversationId}`);
  }

  // ─── Broadcast helpers ────────────────────────────────────────────────────────

  emitConversationCreated(conversation: any): void {
    this.server?.emit('conversation:created', conversation);
  }

  emitConversationUpdated(conversationId: string, data: any): void {
    this.server?.to(`conv:${conversationId}`).emit('conversation:updated', data);
  }

  emitStatusChanged(conversationId: string, status: string): void {
    this.server
      ?.to(`conv:${conversationId}`)
      .emit('conversation:status', { conversationId, status });
  }

  emitConversationAssigned(conversationId: string, agentId: string): void {
    this.server
      ?.to(`conv:${conversationId}`)
      .emit('conversation:assigned', { conversationId, agentId });
  }

  emitMessageAdded(conversationId: string, message: any): void {
    this.server?.to(`conv:${conversationId}`).emit('conversation:message', message);
  }

  emitMessageInbound(conversationId: string, message: any): void {
    this.server?.to(`conv:${conversationId}`).emit('message:inbound', { conversationId, message });
  }

  // ─── Participant events ───────────────────────────────────────────────────────

  emitParticipantInvited(conversationId: string, participant: any): void {
    this.server
      ?.to(`conv:${conversationId}`)
      .emit('participant:invited', { conversationId, participant });
  }

  emitParticipantLeft(conversationId: string, participantId: string): void {
    this.server
      ?.to(`conv:${conversationId}`)
      .emit('participant:left', { conversationId, participantId });
  }
}
