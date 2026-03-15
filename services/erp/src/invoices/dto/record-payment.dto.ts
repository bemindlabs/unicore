import { IsNumber, IsString, IsOptional, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMethodDto {
  CASH = 'CASH', BANK_TRANSFER = 'BANK_TRANSFER', CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD', CRYPTO = 'CRYPTO', OTHER = 'OTHER',
}

export class RecordPaymentDto {
  @IsNumber() @Min(0.01) @Type(() => Number) amount!: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsEnum(PaymentMethodDto) method?: PaymentMethodDto;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() notes?: string;
}
