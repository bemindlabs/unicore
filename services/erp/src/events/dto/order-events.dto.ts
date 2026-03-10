import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional, ValidateNested, ArrayMinSize, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderLineItemDto {
  @IsString() @IsNotEmpty() productId!: string;
  @IsString() @IsNotEmpty() productName!: string;
  @IsString() @IsNotEmpty() sku!: string;
  @IsNumber() @Min(1) quantity!: number;
  @IsNumber() @Min(0) unitPrice!: number;
  @IsNumber() @Min(0) totalPrice!: number;
}

export class OrderCreatedEventDto {
  @IsString() @IsNotEmpty() orderId!: string;
  @IsString() @IsNotEmpty() customerId!: string;
  @IsOptional() @IsString() customerEmail?: string;
  @IsString() status!: string;
  @ValidateNested({ each: true }) @ArrayMinSize(1) @Type(() => OrderLineItemDto) lineItems!: OrderLineItemDto[];
  @IsNumber() @Min(0) subtotal!: number;
  @IsNumber() @Min(0) tax!: number;
  @IsNumber() @Min(0) total!: number;
  @IsString() @IsNotEmpty() currency!: string;
}

export class OrderUpdatedEventDto {
  @IsString() @IsNotEmpty() orderId!: string;
  @IsString() @IsNotEmpty() customerId!: string;
  @IsString() previousStatus!: string;
  @IsString() newStatus!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() updatedFields?: Record<string, unknown>;
}

export class OrderFulfilledEventDto {
  @IsString() @IsNotEmpty() orderId!: string;
  @IsString() @IsNotEmpty() customerId!: string;
  @IsOptional() @IsString() trackingNumber?: string;
  @IsOptional() @IsString() carrier?: string;
  @IsString() @IsNotEmpty() fulfilledAt!: string;
}
