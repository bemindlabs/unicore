import { IsObject } from 'class-validator';

export class ConfigurePluginDto {
  @IsObject()
  config!: Record<string, unknown>;
}
