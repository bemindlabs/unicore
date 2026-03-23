import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  MaxLength,
  ArrayMaxSize,
  IsObject,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ToolCallEntryDto {
  @IsString()
  toolName!: string;

  @IsObject()
  arguments!: Record<string, unknown>;

  @IsOptional()
  result?: unknown;

  @IsOptional()
  @IsString()
  error?: string;

  @IsString()
  @IsIn(['pending', 'success', 'error'])
  status!: 'pending' | 'success' | 'error';
}

export class SuggestedActionDto {
  @IsString()
  @MaxLength(100)
  label!: string;

  @IsString()
  @MaxLength(500)
  value!: string;

  @IsOptional()
  @IsString()
  @IsIn(['default', 'confirm', 'danger'])
  variant?: 'default' | 'confirm' | 'danger';
}

export class ChatMessageDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  text?: string;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToolCallEntryDto)
  @ArrayMaxSize(50)
  toolCalls?: ToolCallEntryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuggestedActionDto)
  @ArrayMaxSize(10)
  suggestedActions?: SuggestedActionDto[];
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
