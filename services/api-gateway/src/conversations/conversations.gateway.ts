import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/conversations', cors: { origin: '*' } })
export class ConversationsGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('join')
  handleJoin(@MessageBody() conversationId: string, @ConnectedSocket() client: Socket) {
    client.join(`conv:${conversationId}`);
  }

  @SubscribeMessage('leave')
  handleLeave(@MessageBody() conversationId: string, @ConnectedSocket() client: Socket) {
    client.leave(`conv:${conversationId}`);
  }

  emitConversationCreated(conversation: any) {
    this.server.emit('conversation:created', conversation);
  }

  emitConversationUpdated(conversationId: string, data: any) {
    this.server.to(`conv:${conversationId}`).emit('conversation:updated', data);
  }

  emitStatusChanged(conversationId: string, status: string) {
    this.server.to(`conv:${conversationId}`).emit('conversation:status', { conversationId, status });
  }

  emitMessageAdded(conversationId: string, message: any) {
    this.server.to(`conv:${conversationId}`).emit('conversation:message', message);
  }
}
