import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsArray,
  IsObject,
  IsOptional,
  ValidateNested,
  IsNumber,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { WorkflowDefinition } from '../schema/workflow-definition.schema';

/** DTO for registering a new workflow definition at runtime. */
export class RegisterDefinitionDto implements WorkflowDefinition {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  enabled!: boolean;

  @IsNumber()
  schemaVersion!: number;

  @IsObject()
  trigger!: WorkflowDefinition['trigger'];

  @IsArray()
  actions!: WorkflowDefinition['actions'];

  @IsString()
  createdAt!: string;

  @IsString()
  updatedAt!: string;
}
