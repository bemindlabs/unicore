import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
export class RejectExpenseDto {
  @IsString() @IsNotEmpty() approvedBy!: string;
  @IsString() @IsOptional() reason?: string;
}
