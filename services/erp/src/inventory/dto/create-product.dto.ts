import {
  IsString, IsOptional, IsNumber, IsInt, Min, IsArray, MinLength, MaxLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString() @MinLength(1) @MaxLength(100) sku!: string;
  @IsString() @MinLength(1) @MaxLength(300) name!: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() category?: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitPrice!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() costPrice?: number = 0;
  @IsInt() @Min(0) @IsOptional() quantity?: number = 0;
  @IsInt() @Min(0) @IsOptional() reservedQuantity?: number = 0;
  @IsInt() @Min(0) @IsOptional() lowStockThreshold?: number = 10;
  @IsString() @IsOptional() warehouseId?: string;
  @IsString() @IsOptional() supplierId?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() tags?: string[] = [];
}
