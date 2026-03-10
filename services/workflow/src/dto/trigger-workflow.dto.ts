import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class TriggerWorkflowDto {
  @IsString()
  @IsNotEmpty()
  workflowId!: string;

  @IsOptional()
  payload?: unknown;
}
