import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class TokenExchangeDto {
  @IsString()
  @IsNotEmpty()
  platformToken: string;

  @IsOptional()
  @IsString()
  @IsIn(['dashboard', 'portal-geek', 'portal-ai-dlc'])
  targetApp?: string;
}
