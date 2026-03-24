import { IsString, IsOptional, MaxLength, IsEmail } from 'class-validator';

/** Enum mirror of the ConversationChannel Prisma enum for DTO validation */
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
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  channel?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  initialMessage?: string;
}
