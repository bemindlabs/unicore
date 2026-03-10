import { IsString, IsOptional } from 'class-validator';
export class ShipOrderDto {
  @IsString() @IsOptional() trackingNumber?: string;
  @IsString() @IsOptional() carrier?: string;
}
