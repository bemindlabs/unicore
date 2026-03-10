import { IsString, IsOptional, MaxLength } from 'class-validator';
export class UpdateOrderDto {
  @IsString() @IsOptional() @MaxLength(1000) notes?: string;
  @IsString() @IsOptional() shippingAddress?: string;
}
