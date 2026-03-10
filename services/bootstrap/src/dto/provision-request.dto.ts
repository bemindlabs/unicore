import { IsString, IsEmail, IsNotEmpty, IsOptional, MinLength, IsIn } from 'class-validator';

const VALID_TEMPLATES = [
  'ecommerce',
  'freelance',
  'saas',
  'retail',
  'content-creator',
  'professional',
  'custom',
] as const;

export class ProvisionRequestDto {
  @IsString()
  @IsNotEmpty()
  bootstrapSecret!: string;

  @IsString()
  @IsNotEmpty()
  businessName!: string;

  @IsIn(VALID_TEMPLATES)
  template!: (typeof VALID_TEMPLATES)[number];

  @IsOptional()
  @IsString()
  industry?: string;

  @IsString()
  @IsNotEmpty()
  locale!: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsString()
  @IsNotEmpty()
  timezone!: string;

  @IsString()
  @IsNotEmpty()
  adminName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  adminPassword!: string;
}
