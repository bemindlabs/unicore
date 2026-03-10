import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum OrderStatusFilter {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  FULFILLED = 'FULFILLED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export class QueryOrdersDto extends PaginationDto {
  @IsEnum(OrderStatusFilter)
  @IsOptional()
  status?: OrderStatusFilter;

  @IsUUID()
  @IsOptional()
  contactId?: string;
}
