import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LlmRole } from '../../llm/interfaces/llm-provider.interface';

export class MessageDto {
  @IsEnum(['system', 'user', 'assistant'])
  role!: LlmRole;

  @IsString()
  content!: string;
}

export class CompleteRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages!: MessageDto[];

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  agentId?: string;
}

export class EmbedRequestDto {
  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  agentId?: string;
}
