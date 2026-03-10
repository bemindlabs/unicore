import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsArray,
  IsUrl,
  MinLength,
  MaxLength,
} from 'class-validator';

export enum ContactType {
  LEAD = 'LEAD',
  CUSTOMER = 'CUSTOMER',
  VENDOR = 'VENDOR',
  PARTNER = 'PARTNER',
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

  @IsUrl()
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
