import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class InventoryLowPayloadDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsNumber()
  @Min(0)
  currentQuantity!: number;

  @IsNumber()
  @Min(0)
  threshold!: number;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;
}

export class InventoryRestockedPayloadDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsNumber()
  @Min(0)
  previousQuantity!: number;

  @IsNumber()
  @Min(1)
  quantityAdded!: number;

  @IsNumber()
  @Min(0)
  newQuantity!: number;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  purchaseOrderId?: string;
}
