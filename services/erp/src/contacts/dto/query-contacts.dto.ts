import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ContactType } from './create-contact.dto';

export class QueryContactsDto extends PaginationDto {
  @IsEnum(ContactType) @IsOptional() type?: ContactType;
  @IsInt() @Min(0) @Max(100) @Type(() => Number) @IsOptional() minLeadScore?: number;
}
