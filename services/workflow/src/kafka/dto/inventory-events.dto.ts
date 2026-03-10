export interface InventoryLowPayloadDto {
  productId: string;
  productName: string;
  sku: string;
  currentQuantity: number;
  threshold: number;
  warehouseId?: string;
  supplierId?: string;
}

export interface InventoryRestockedPayloadDto {
  productId: string;
  productName: string;
  sku: string;
  previousQuantity: number;
  quantityAdded: number;
  newQuantity: number;
  warehouseId?: string;
  purchaseOrderId?: string;
}
