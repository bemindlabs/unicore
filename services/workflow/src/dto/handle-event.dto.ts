import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class HandleEventDto {
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsOptional()
  payload?: unknown;
}
