import {
  IsString, IsEmail, IsOptional, IsEnum, IsInt, Min, Max, IsArray, MinLength, MaxLength,
} from 'class-validator';

export enum ContactType {
  LEAD = 'LEAD',
  PROSPECT = 'PROSPECT',
  CUSTOMER = 'CUSTOMER',
  PARTNER = 'PARTNER',
  VENDOR = 'VENDOR',
  ARCHIVED = 'ARCHIVED',
}

export class CreateContactDto {
  @IsEnum(ContactType)
  @IsOptional()
  type?: ContactType = ContactType.LEAD;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  company?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  currency?: string = 'USD';

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  leadScore?: number = 0;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[] = [];

  @IsString()
  @IsOptional()
  notes?: string;
}
