import { IsInt, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AdjustStockDto {
  @IsInt() @Type(() => Number) delta: number;
  @IsString() reason: string;
  @IsOptional() @IsString() referenceId?: string;
  @IsOptional() @IsString() performedBy?: string;
}
