import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateCannedResponseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  shortcut!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;
}

export class UpdateCannedResponseDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(80)
  shortcut?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(5000)
  text?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;
}
