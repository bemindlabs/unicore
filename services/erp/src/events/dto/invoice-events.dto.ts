import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
export class InvoiceCreatedEventDto {
  @IsString() @IsNotEmpty() invoiceId!: string;
  @IsString() @IsNotEmpty() invoiceNumber!: string;
  @IsString() @IsNotEmpty() contactId!: string;
  @IsNumber() @Min(0) total!: number;
  @IsString() @IsNotEmpty() currency!: string;
  @IsOptional() @IsString() dueDate?: string;
}
export class InvoiceOverdueEventDto {
  @IsString() @IsNotEmpty() invoiceId!: string;
  @IsString() @IsNotEmpty() invoiceNumber!: string;
  @IsString() @IsNotEmpty() contactId!: string;
  @IsNumber() @Min(0) amountDue!: number;
  @IsString() @IsNotEmpty() currency!: string;
  @IsNumber() @Min(0) daysOverdue!: number;
}
export class InvoicePaidEventDto {
  @IsString() @IsNotEmpty() invoiceId!: string;
  @IsString() @IsNotEmpty() invoiceNumber!: string;
  @IsString() @IsNotEmpty() contactId!: string;
  @IsNumber() @Min(0) amountPaid!: number;
  @IsString() @IsNotEmpty() currency!: string;
  @IsOptional() @IsString() paymentMethod?: string;
  @IsString() @IsNotEmpty() paidAt!: string;
}
