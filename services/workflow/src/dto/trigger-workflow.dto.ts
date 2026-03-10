import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/** Request body for manually triggering a workflow. */
export class TriggerWorkflowDto {
  @IsString()
  @IsNotEmpty()
  workflowId!: string;

  /** Optional payload passed as the trigger event data. */
  @IsOptional()
  payload?: unknown;
}
