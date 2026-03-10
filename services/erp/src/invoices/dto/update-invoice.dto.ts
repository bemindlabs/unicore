import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class UpdateInvoiceDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
