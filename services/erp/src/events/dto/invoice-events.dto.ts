import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  OVERDUE = 'overdue',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export class InvoiceCreatedEventDto {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsOptional()
  @IsString()
  orderId?: string;

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

  @IsEnum(InvoiceStatus)
  status!: InvoiceStatus;

  @IsString()
  @IsNotEmpty()
  issuedAt!: string;

  @IsString()
  @IsNotEmpty()
  dueAt!: string;
}

export class InvoiceOverdueEventDto {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsNumber()
  @Min(0)
  total!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsString()
  @IsNotEmpty()
  dueAt!: string;

  @IsNumber()
  @Min(0)
  daysOverdue!: number;
}

export class InvoicePaidEventDto {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsNumber()
  @Min(0)
  amountPaid!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsString()
  @IsNotEmpty()
  paidAt!: string;
}
