import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export enum InvoiceStatusEvent {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  VIEWED = 'VIEWED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  VOID = 'VOID',
  WRITTEN_OFF = 'WRITTEN_OFF',
}

export enum PaymentMethodEvent {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  PROMPTPAY = 'PROMPTPAY',
  QR_CODE = 'QR_CODE',
  CRYPTO = 'CRYPTO',
  OTHER = 'OTHER',
}

export class InvoiceCreatedEventDto {
  @IsUUID()
  invoiceId!: string;

  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsEnum(InvoiceStatusEvent)
  status!: InvoiceStatusEvent;

  @IsNumber()
  @Min(0)
  total!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsString()
  @IsNotEmpty()
  dueDate!: string;

  isRecurring!: boolean;
}

export class InvoiceOverdueEventDto {
  @IsUUID()
  invoiceId!: string;

  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsNumber()
  @Min(0)
  amountDue!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsNumber()
  daysOverdue!: number;
}

export class InvoicePaidEventDto {
  @IsUUID()
  invoiceId!: string;

  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsNumber()
  @Min(0)
  amountPaid!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsEnum(PaymentMethodEvent)
  method!: PaymentMethodEvent;

  @IsString()
  @IsNotEmpty()
  paidAt!: string;
}
