import { IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class InventoryLowEventDto {
  @IsUUID()
  inventoryItemId!: string;

  @IsUUID()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsUUID()
  warehouseId!: string;

  @IsString()
  @IsNotEmpty()
  warehouseName!: string;

  @IsNumber()
  quantityAvailable!: number;

  @IsNumber()
  reorderPoint!: number;

  @IsNumber()
  @Min(0)
  reorderQty!: number;
}

export class InventoryRestockedEventDto {
  @IsUUID()
  inventoryItemId!: string;

  @IsUUID()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsUUID()
  warehouseId!: string;

  @IsNumber()
  quantityAdded!: number;

  @IsNumber()
  newQuantityOnHand!: number;
}
