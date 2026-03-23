import { IsString, IsNotEmpty } from 'class-validator';

export class RejectPluginDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
