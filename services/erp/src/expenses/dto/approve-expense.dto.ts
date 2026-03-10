import { IsString, IsOptional } from 'class-validator';

export class ApproveExpenseDto {
  @IsString() approvedBy: string;
  @IsOptional() @IsString() notes?: string;
}
