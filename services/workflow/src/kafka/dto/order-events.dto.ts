export interface OrderLineItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderCreatedPayloadDto {
  orderId: string;
  customerId: string;
  customerEmail?: string;
  status: string;
  lineItems: OrderLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
}

export interface OrderUpdatedPayloadDto {
  orderId: string;
  customerId: string;
  previousStatus: string;
  newStatus: string;
  notes?: string;
  updatedFields?: Record<string, unknown>;
}

export interface OrderFulfilledPayloadDto {
  orderId: string;
  customerId: string;
  trackingNumber?: string;
  carrier?: string;
  fulfilledAt: string;
}
