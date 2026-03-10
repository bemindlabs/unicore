export interface InvoiceCreatedPayloadDto {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  orderId?: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  issuedAt: string;
  dueDate: string;
}

export interface InvoiceOverduePayloadDto {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  total: number;
  currency: string;
  dueAt: string;
  daysOverdue: number;
}

export interface InvoicePaidPayloadDto {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  amountPaid: number;
  currency: string;
  paymentMethod?: string;
  transactionId?: string;
  paidAt: string;
}
