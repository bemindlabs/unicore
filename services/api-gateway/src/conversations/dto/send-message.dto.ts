import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum MessageTypeDto {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  STICKER = 'STICKER',
  LOCATION = 'LOCATION',
  TEMPLATE = 'TEMPLATE',
  SYSTEM = 'SYSTEM',
}

export class SendMessageDto {
  @IsOptional()
  @IsEnum(MessageTypeDto)
  type?: MessageTypeDto;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  attachments?: any[];

  @IsOptional()
  sender?: Record<string, any>;

  @IsOptional()
  metadata?: Record<string, any>;
}
