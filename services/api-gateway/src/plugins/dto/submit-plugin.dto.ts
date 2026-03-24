import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class SubmitPluginDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsIn(['integration', 'ai', 'workflow', 'ui', 'utility'])
  type: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  version: string;

  @IsString()
  @IsNotEmpty()
  author: string;

  @IsOptional()
  @IsString()
  icon?: string;
}
