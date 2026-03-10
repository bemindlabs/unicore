import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum InvoiceStatusFilter {
  DRAFT = 'DRAFT', SENT = 'SENT', PAID = 'PAID', OVERDUE = 'OVERDUE', CANCELLED = 'CANCELLED',
}

export class QueryInvoicesDto extends PaginationDto {
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() orderId?: string;
  @IsOptional() @IsEnum(InvoiceStatusFilter) status?: InvoiceStatusFilter;
}
