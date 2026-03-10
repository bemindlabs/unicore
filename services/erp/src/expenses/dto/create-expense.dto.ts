import { IsString, IsOptional, IsNumber, IsArray, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsString() category: string;
  @IsNumber() @Min(0.01) @Type(() => Number) amount: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() submittedBy?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
