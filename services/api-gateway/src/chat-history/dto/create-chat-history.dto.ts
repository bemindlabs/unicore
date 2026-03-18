import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @IsString()
  id!: string;

  @IsString()
  @MaxLength(50000)
  text!: string;

  @IsString()
  @MaxLength(200)
  author!: string;

  @IsString()
  @MaxLength(200)
  authorId!: string;

  @IsString()
  @IsOptional()
  authorType?: string;

  @IsString()
  @IsOptional()
  authorColor?: string;

  @IsString()
  @IsOptional()
  channel?: string;

  @IsString()
  @IsOptional()
  timestamp?: string;
}

export class CreateChatHistoryDto {
  @IsString()
  @MaxLength(200)
  agentId!: string;

  @IsString()
  @MaxLength(200)
  agentName!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  @ArrayMaxSize(500)
  messages!: ChatMessageDto[];

  @IsString()
  @IsOptional()
  @MaxLength(500)
  summary?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  channel?: string;
}
