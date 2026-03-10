import { IsInt, IsString, IsOptional, Min, IsNotEmpty } from 'class-validator';

export class RestockProductDto {
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @IsOptional()
  purchaseOrderId?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  performedBy?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
