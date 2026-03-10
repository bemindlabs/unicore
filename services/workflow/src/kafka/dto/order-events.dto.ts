import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  FULFILLED = 'fulfilled',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export class OrderLineItemDto {
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
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  totalPrice!: number;
}

export class OrderCreatedPayloadDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => OrderLineItemDto)
  lineItems!: OrderLineItemDto[];

  @IsNumber()
  @Min(0)
  subtotal!: number;

  @IsNumber()
  @Min(0)
  tax!: number;

  @IsNumber()
  @Min(0)
  total!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;
}

export class OrderUpdatedPayloadDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsEnum(OrderStatus)
  previousStatus!: OrderStatus;

  @IsEnum(OrderStatus)
  newStatus!: OrderStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  updatedFields?: Record<string, unknown>;
}

export class OrderFulfilledPayloadDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

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
