import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  MinLength,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IngestDocumentMetadataDto {
  @IsString()
  @IsNotEmpty()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  createdAt?: string;
}

export class IngestDocumentDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100_000)
  content!: string;

  @ValidateNested()
  @Type(() => IngestDocumentMetadataDto)
  metadata!: IngestDocumentMetadataDto;
}

export class IngestBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestDocumentDto)
  documents!: IngestDocumentDto[];
}

export enum DeleteScopeType {
  DOCUMENT = 'document',
  WORKSPACE = 'workspace',
  AGENT = 'agent',
}

export class DeleteDocumentsDto {
  @IsEnum(DeleteScopeType)
  scope!: DeleteScopeType;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsString()
  @IsNotEmpty()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  agentId?: string;
}
