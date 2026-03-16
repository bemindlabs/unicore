import { IsInt, IsString, IsOptional, Min } from 'class-validator';

export class RestockProductDto {
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @IsOptional()
  purchaseOrderId?: string;

  @IsString()
  @IsOptional()
  performedBy?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
