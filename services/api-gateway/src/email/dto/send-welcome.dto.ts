import { IsString, IsEmail, IsArray, IsOptional, IsNotEmpty, IsUrl } from 'class-validator';

export class SendWelcomeDto {
  @IsString()
  @IsNotEmpty()
  adminName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @IsOptional()
  licenseKey?: string;

  @IsString()
  @IsNotEmpty()
  businessName!: string;

  @IsUrl()
  @IsNotEmpty()
  dashboardUrl!: string;

  @IsArray()
  @IsString({ each: true })
  agentsEnabled!: string[];

  @IsArray()
  @IsString({ each: true })
  erpModulesEnabled!: string[];

  @IsString()
  @IsNotEmpty()
  bootstrapSecret!: string;
}
