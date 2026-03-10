import { IsString, IsOptional } from 'class-validator';

export class RejectExpenseDto {
  @IsString() rejectedBy: string;
  @IsOptional() @IsString() reason?: string;
}
