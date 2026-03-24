import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import type { NormalizedMessage } from './inbound-router.service';

/**
 * WebhooksGateway — real-time WebSocket gateway for broadcasting inbound channel messages.
 *
 * Clients (e.g. the dashboard's Omni-Channel Conversation Hub) connect here to
 * receive live updates whenever a new message arrives from any channel
 * (Telegram, LINE, WhatsApp, email, webchat, etc.).
 *
 * WebSocket endpoint: wss://<host>:4000/webhooks-ws
 * Events emitted:
 *   - inbound_message: { channel, senderId, senderName, text, timestamp, rawPayload? }
 */
@WebSocketGateway({ path: '/webhooks-ws' })
export class WebhooksGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(WebhooksGateway.name);

  afterInit(): void {
    this.logger.log('WebhooksGateway initialized on /webhooks-ws');
  }

  handleConnection(client: WebSocket): void {
    this.logger.debug('WebSocket client connected to WebhooksGateway');
    client.send(JSON.stringify({ event: 'connected', data: { ok: true } }));
  }

  handleDisconnect(): void {
    this.logger.debug('WebSocket client disconnected from WebhooksGateway');
  }

  /**
   * Broadcast a normalized inbound message to all connected dashboard clients.
   */
  broadcastInbound(message: NormalizedMessage): void {
    const payload = JSON.stringify({ event: 'inbound_message', data: message });
    let sent = 0;
    this.server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
        sent++;
      }
    });
    if (sent > 0) {
      this.logger.debug(
        `Broadcast inbound_message to ${sent} client(s): channel=${message.channel}`,
      );
    }
  }
}
