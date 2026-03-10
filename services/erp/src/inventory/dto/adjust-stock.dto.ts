import { IsInt, IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class AdjustStockDto {
  @IsInt()
  delta!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsOptional()
  referenceId?: string;

  @IsString()
  @IsOptional()
  performedBy?: string;
}
