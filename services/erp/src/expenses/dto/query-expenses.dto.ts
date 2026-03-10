import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum ExpenseStatusFilter {
  PENDING = 'PENDING', APPROVED = 'APPROVED', REJECTED = 'REJECTED', REIMBURSED = 'REIMBURSED',
}

export class QueryExpensesDto extends PaginationDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() submittedBy?: string;
  @IsOptional() @IsEnum(ExpenseStatusFilter) status?: ExpenseStatusFilter;
}
