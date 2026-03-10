import { IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class RegisterPromptDto {
  @IsString()
  key!: string;

  @IsString()
  name!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdatePromptDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class RenderPromptDto {
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  version?: number;

  @IsOptional()
  @IsBoolean()
  strict?: boolean;
}
