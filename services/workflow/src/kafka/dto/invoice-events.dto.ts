import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum, Min, IsDateString } from 'class-validator';

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  OVERDUE = 'overdue',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  VOID = 'void',
}

export class InvoiceCreatedPayloadDto {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsEnum(InvoiceStatus)
  status!: InvoiceStatus;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsNumber()
  @Min(0)
  tax!: number;

  @IsNumber()
  @Min(0)
  total!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsDateString()
  dueDate!: string;

  @IsDateString()
  issuedAt!: string;
}

export class InvoiceOverduePayloadDto {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsNumber()
  @Min(0)
  total!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsDateString()
  dueDate!: string;

  /** Number of days the invoice is overdue. */
  @IsNumber()
  @Min(1)
  daysOverdue!: number;

  @IsOptional()
  @IsString()
  customerEmail?: string;
}

export class InvoicePaidPayloadDto {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsNumber()
  @Min(0)
  amountPaid!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsDateString()
  paidAt!: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;
}
