import { IsString, IsOptional, IsNumber, IsIn, Min, Max, MaxLength } from 'class-validator';

export class CreateHandoffDto {
  @IsString()
  @MaxLength(200)
  channel!: string;

  @IsString()
  @MaxLength(200)
  userId!: string;

  @IsString()
  @IsIn(['low_confidence', 'explicit_request', 'user_request'])
  trigger!: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  conversationId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  contextSummary?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(1440)
  slaMinutes?: number;
}

export class ClaimHandoffDto {
  @IsString()
  @MaxLength(200)
  operatorId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  operatorName?: string;
}
