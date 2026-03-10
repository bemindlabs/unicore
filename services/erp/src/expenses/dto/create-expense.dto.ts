import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  IsDateString,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsOptional()
  currency?: string = 'USD';

  @IsString()
  @IsOptional()
  vendor?: string;

  @IsDateString()
  @IsOptional()
  paidAt?: string;

  @IsString()
  @IsOptional()
  submittedBy?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[] = [];
}
