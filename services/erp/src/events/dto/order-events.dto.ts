import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderStatusEvent {
  DRAFT = 'DRAFT',
  QUOTED = 'QUOTED',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  PARTIALLY_FULFILLED = 'PARTIALLY_FULFILLED',
  FULFILLED = 'FULFILLED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum FulfillmentStatusEvent {
  PENDING = 'PENDING',
  PICKING = 'PICKING',
  PACKED = 'PACKED',
  DISPATCHED = 'DISPATCHED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETURNED = 'RETURNED',
}

export class OrderLineItemDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  lineTotal!: number;
}

export class OrderCreatedEventDto {
  @IsUUID()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  orderNumber!: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsEnum(OrderStatusEvent)
  status!: OrderStatusEvent;

  @IsEnum(FulfillmentStatusEvent)
  fulfillmentStatus!: FulfillmentStatusEvent;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineItemDto)
  items!: OrderLineItemDto[];

  @IsNumber()
  @Min(0)
  subtotal!: number;

  @IsNumber()
  @Min(0)
  taxAmount!: number;

  @IsNumber()
  @Min(0)
  total!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;
}

export class OrderUpdatedEventDto {
  @IsUUID()
  orderId!: string;

  @IsEnum(OrderStatusEvent)
  previousStatus!: OrderStatusEvent;

  @IsEnum(OrderStatusEvent)
  newStatus!: OrderStatusEvent;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  updatedFields?: Record<string, unknown>;
}

export class OrderFulfilledEventDto {
  @IsUUID()
  orderId!: string;

  @IsEnum(FulfillmentStatusEvent)
  fulfillmentStatus!: FulfillmentStatusEvent;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  carrier?: string;

  @IsString()
  @IsNotEmpty()
  fulfilledAt!: string;
}
