import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryProductsDto extends PaginationDto {
  @IsString()
  @IsOptional()
  category?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  lowStock?: boolean;
}
