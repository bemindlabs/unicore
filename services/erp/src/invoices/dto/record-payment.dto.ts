import { IsNumber, IsString, IsOptional, IsEnum, Min, IsNotEmpty } from 'class-validator';

export enum PaymentMethodDto {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  CRYPTO = 'CRYPTO',
  OTHER = 'OTHER',
}

export class RecordPaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsOptional()
  currency?: string = 'USD';

  @IsEnum(PaymentMethodDto)
  @IsOptional()
  method?: PaymentMethodDto = PaymentMethodDto.BANK_TRANSFER;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
