import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
export class ApproveExpenseDto {
  @IsString() @IsNotEmpty() approvedBy!: string;
  @IsString() @IsOptional() notes?: string;
}
