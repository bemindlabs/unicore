import { IsString, IsOptional, IsArray, IsNumber, IsInt, Min, ValidateNested, IsUUID, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() unitPrice?: number;
}
export class CreateOrderDto {
  @IsUUID() contactId!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateOrderItemDto) lineItems!: CreateOrderItemDto[];
  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @IsOptional() taxRate?: number = 0;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() discount?: number = 0;
  @IsString() @IsOptional() currency?: string = 'USD';
  @IsString() @IsOptional() @MaxLength(1000) notes?: string;
  @IsString() @IsOptional() shippingAddress?: string;
}
