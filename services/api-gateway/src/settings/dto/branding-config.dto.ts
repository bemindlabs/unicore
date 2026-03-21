import {
  IsOptional,
  IsString,
  MaxLength,
  IsUrl,
  IsBoolean,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FontConfigDto {
  @IsString()
  family: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  weights?: string[];
}

export class BrandingColorsDto {
  @IsOptional()
  @IsString()
  primary?: string;

  @IsOptional()
  @IsString()
  secondary?: string;

  @IsOptional()
  @IsString()
  accent?: string;

  @IsOptional()
  @IsString()
  background?: string;

  @IsOptional()
  @IsString()
  surface?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  textMuted?: string;

  @IsOptional()
  @IsString()
  border?: string;

  @IsOptional()
  @IsString()
  success?: string;

  @IsOptional()
  @IsString()
  error?: string;
}

export class BrandingConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  appName?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsUrl()
  logoIconUrl?: string;

  @IsOptional()
  @IsUrl()
  faviconUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandingColorsDto)
  colors?: BrandingColorsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FontConfigDto)
  bodyFont?: FontConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FontConfigDto)
  headingFont?: FontConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FontConfigDto)
  monoFont?: FontConfigDto;

  @IsOptional()
  @IsBoolean()
  removeUnicoreBranding?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  customCss?: string;
}
