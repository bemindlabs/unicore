import { IsOptional, IsString, IsObject } from 'class-validator';

export class InstallPluginDto {
  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  instanceId?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
