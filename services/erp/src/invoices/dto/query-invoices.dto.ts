import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum InvoiceStatusFilter {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export class QueryInvoicesDto extends PaginationDto {
  @IsEnum(InvoiceStatusFilter)
  @IsOptional()
  status?: InvoiceStatusFilter;

  @IsUUID()
  @IsOptional()
  contactId?: string;
}
