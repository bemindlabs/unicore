import { IsString, IsOptional, IsNumber, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString() sku: string;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsNumber() @Min(0) @Type(() => Number) unitPrice: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) costPrice?: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) quantity?: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) lowStockThreshold?: number;
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
