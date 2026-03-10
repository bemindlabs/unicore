import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryProductsDto extends PaginationDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) minQuantity?: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) maxQuantity?: number;
  @IsOptional() lowStockOnly?: string;
}
