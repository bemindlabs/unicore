import { IsString, IsOptional } from 'class-validator';
export class FulfillOrderDto {
  @IsString() @IsOptional() trackingNumber?: string;
  @IsString() @IsOptional() carrier?: string;
  @IsString() @IsOptional() notes?: string;
}
