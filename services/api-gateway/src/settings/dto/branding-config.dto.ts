import {
  IsOptional,
  IsString,
  MaxLength,
  IsUrl,
  IsHexColor,
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
  @IsHexColor()
  primary?: string;

  @IsOptional()
  @IsHexColor()
  secondary?: string;

  @IsOptional()
  @IsHexColor()
  accent?: string;

  @IsOptional()
  @IsHexColor()
  background?: string;

  @IsOptional()
  @IsHexColor()
  surface?: string;

  @IsOptional()
  @IsHexColor()
  text?: string;

  @IsOptional()
  @IsHexColor()
  textMuted?: string;

  @IsOptional()
  @IsHexColor()
  border?: string;

  @IsOptional()
  @IsHexColor()
  success?: string;

  @IsOptional()
  @IsHexColor()
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
