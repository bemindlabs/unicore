import { IsInt, IsString, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RestockProductDto {
  @IsInt() @Min(1) @Type(() => Number) quantity: number;
  @IsOptional() @IsString() referenceId?: string;
  @IsOptional() @IsString() performedBy?: string;
  @IsOptional() @IsString() notes?: string;
}
