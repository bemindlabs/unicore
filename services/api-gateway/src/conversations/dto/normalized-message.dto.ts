import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

/**
 * NormalizedMessageDto — canonical shape for inbound messages across all channels.
 *
 * Webhook controllers (Telegram, LINE, etc.) normalize their raw payloads
 * into this shape before passing to InboundRouterService.
 */
export class NormalizedMessageDto {
  /** Channel identifier: 'telegram' | 'line' | 'facebook' | 'instagram' | 'whatsapp' | 'slack' | 'discord' */
  @IsString()
  @IsNotEmpty()
  channel!: string;

  /** Channel-specific conversation/chat/room ID (used to find/create a Conversation record) */
  @IsString()
  @IsNotEmpty()
  conversationExternalId!: string;

  /** Channel-specific sender ID */
  @IsString()
  @IsNotEmpty()
  senderId!: string;

  /** Display name of the sender */
  @IsString()
  @IsOptional()
  senderName?: string;

  /** Normalized text content of the message */
  @IsString()
  @IsNotEmpty()
  text!: string;

  /** Optional external message ID for deduplication */
  @IsString()
  @IsOptional()
  externalMessageId?: string;

  /** Raw webhook payload for audit/replay */
  @IsObject()
  @IsOptional()
  rawPayload?: Record<string, unknown>;
}
