import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ConversationChannelDto {
  TELEGRAM = 'TELEGRAM',
  LINE = 'LINE',
  FACEBOOK = 'FACEBOOK',
  INSTAGRAM = 'INSTAGRAM',
  WHATSAPP = 'WHATSAPP',
  SLACK = 'SLACK',
  DISCORD = 'DISCORD',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  LIVE_CHAT = 'LIVE_CHAT',
}

export class CreateConversationDto {
  @IsEnum(ConversationChannelDto)
  channel: ConversationChannelDto;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  contactChannelId?: string;
}
