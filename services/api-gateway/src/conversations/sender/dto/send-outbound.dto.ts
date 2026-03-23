import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendOutboundDto {
  /** Internal conversation UUID (must exist in the conversations table) */
  @IsString()
  @MaxLength(200)
  conversationId!: string;

  /** Target channel: 'telegram' | 'line' | 'whatsapp' | 'slack' | 'discord' | … */
  @IsString()
  @MaxLength(50)
  channelType!: string;

  /** Plain-text message body to deliver */
  @IsString()
  @MaxLength(50000)
  text!: string;

  /** Channel-specific recipient identifier (chatId, userId, roomId, …) */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  recipientId?: string;

  /** Agent that is sending the message (omit for human operators) */
  @IsString()
  @IsOptional()
  @MaxLength(200)
  fromAgentId?: string;

  /** Arbitrary key-value metadata forwarded as-is to the persisted record */
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class SwitchChannelDto {
  /** Conversation to switch */
  @IsString()
  @MaxLength(200)
  conversationId!: string;

  /** New target channel type */
  @IsString()
  @MaxLength(50)
  newChannelType!: string;

  /** Recipient identifier on the new channel */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  recipientId?: string;
}

export interface OutboundResult {
  id: string;
  success: boolean;
  externalId?: string;
  timestamp: string;
  error?: string;
}
