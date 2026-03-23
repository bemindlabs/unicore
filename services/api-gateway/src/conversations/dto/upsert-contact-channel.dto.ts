import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ConversationChannelDto } from './create-conversation.dto';

export class UpsertContactChannelDto {
  @IsEnum(ConversationChannelDto)
  channel: ConversationChannelDto;

  @IsString()
  externalId: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  erpContactId?: string;
}
