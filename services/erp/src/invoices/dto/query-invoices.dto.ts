import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum InvoiceStatusFilter {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  VIEWED = 'VIEWED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  VOID = 'VOID',
  WRITTEN_OFF = 'WRITTEN_OFF',
}

export class QueryInvoicesDto extends PaginationDto {
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() orderId?: string;
  @IsOptional() @IsEnum(InvoiceStatusFilter) status?: InvoiceStatusFilter;
}
