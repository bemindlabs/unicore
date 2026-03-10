import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/** Request body for submitting a domain event to the workflow engine. */
export class HandleEventDto {
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsOptional()
  payload?: unknown;
}
