import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RetrievalQueryDto {
  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsString()
  @IsNotEmpty()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 5;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  scoreThreshold?: number = 0.7;

  @IsOptional()
  @IsBoolean()
  includeContent?: boolean = true;
}

export class SearchResultDto {
  id!: string;
  documentId!: string;
  content?: string;
  score!: number;
  metadata!: Record<string, unknown>;
}

export class RetrievalResponseDto {
  results!: SearchResultDto[];
  query!: string;
  workspaceId!: string;
  totalFound!: number;
}
