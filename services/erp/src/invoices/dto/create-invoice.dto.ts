import {
  IsString, IsOptional, IsArray, IsNumber, IsInt, Min,
  ValidateNested, IsUUID, IsDateString, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceItemDto {
  @IsString()
  @MaxLength(500)
  description!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;
}

export class CreateInvoiceDto {
  @IsUUID()
  contactId!: string;

  @IsUUID()
  @IsOptional()
  orderId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  lineItems!: CreateInvoiceItemDto[];

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @IsOptional()
  taxRate?: number = 0;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  discount?: number = 0;

  @IsString()
  @IsOptional()
  currency?: string = 'USD';

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
