import { IsOptional, IsEnum, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum ExpenseStatusFilter {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REIMBURSED = 'REIMBURSED',
}

export class QueryExpensesDto extends PaginationDto {
  @IsEnum(ExpenseStatusFilter)
  @IsOptional()
  status?: ExpenseStatusFilter;

  @IsString()
  @IsOptional()
  category?: string;
}
