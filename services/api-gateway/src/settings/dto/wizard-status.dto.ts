import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class WizardStatusDto {
  @IsBoolean()
  completed!: boolean;

  @IsOptional()
  @IsString()
  completedAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
