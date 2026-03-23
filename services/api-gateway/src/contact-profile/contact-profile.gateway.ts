import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * ContactProfileGateway — real-time push for contact-profile events.
 *
 * Clients join a room named `contact:<contactId>` to receive live updates
 * whenever an agent note is created/updated/deleted for that contact.
 *
 * Port 4001 (distinct from the main HTTP port 4000).
 */
@WebSocketGateway(4001, {
  namespace: '/contact-profile',
  cors: { origin: '*' },
  transports: ['websocket'],
})
export class ContactProfileGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ContactProfileGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { contactId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data?.contactId) {
      void client.join(`contact:${data.contactId}`);
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { contactId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data?.contactId) {
      void client.leave(`contact:${data.contactId}`);
    }
  }

  // ------------------------------------------------------------------
  // Push helpers called by ContactProfileController
  // ------------------------------------------------------------------

  emitNoteCreated(contactId: string, note: unknown) {
    this.server.to(`contact:${contactId}`).emit('note:created', note);
  }

  emitNoteUpdated(contactId: string, note: unknown) {
    this.server.to(`contact:${contactId}`).emit('note:updated', note);
  }

  emitNoteDeleted(contactId: string, noteId: string) {
    this.server.to(`contact:${contactId}`).emit('note:deleted', { noteId });
  }

  emitChannelUpdated(contactId: string, channel: unknown) {
    this.server.to(`contact:${contactId}`).emit('channel:updated', channel);
  }
}
