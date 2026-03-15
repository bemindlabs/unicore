import { IsString, IsOptional, IsNumber, IsArray, IsDateString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceItemDto {
  @IsString() description!: string;
  @IsNumber() @Min(1) @Type(() => Number) quantity!: number;
  @IsNumber() @Min(0) @Type(() => Number) unitPrice!: number;
}

export class CreateInvoiceDto {
  @IsString() contactId!: string;
  @IsOptional() @IsString() orderId?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateInvoiceItemDto) lineItems!: CreateInvoiceItemDto[];
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) taxRate?: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) discount?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() notes?: string;
}
