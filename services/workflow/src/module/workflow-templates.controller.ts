import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Post,
  Body,
} from '@nestjs/common';
import { TemplateRegistryService } from '../registry/template-registry.service';
import type { WorkflowDefinition, TriggerType } from '../schema/workflow-definition.schema';

/** Response shape for single-definition endpoints. */
interface DefinitionResponse {
  success: true;
  data: WorkflowDefinition;
}

/** Response shape for list endpoints. */
interface DefinitionListResponse {
  success: true;
  total: number;
  data: WorkflowDefinition[];
}

/** Response shape for the validation endpoint. */
interface ValidationResponse {
  success: true;
  data: { valid: boolean; errors: string[] };
}

/**
 * WorkflowTemplatesController exposes the pre-built workflow template registry
 * over HTTP for the Dashboard UI and integration consumers.
 *
 * Base path: /templates (proxied via /api/proxy/workflow/templates)
 */
@Controller('templates')
export class WorkflowTemplatesController {
  constructor(private readonly registry: TemplateRegistryService) {}

  /**
   * GET /workflow/templates
   * Lists all registered workflow template definitions.
   * Pass `?enabledOnly=false` to include disabled templates.
   */
  @Get()
  findAll(@Query('enabledOnly') enabledOnly?: string): DefinitionListResponse {
    const flag = enabledOnly === undefined || enabledOnly !== 'false';
    const data = this.registry.findAll(flag);
    return { success: true, total: data.length, data };
  }

  /**
   * GET /workflow/templates/trigger/:type
   * Returns all enabled templates for the given Kafka-style trigger type,
   * e.g. `erp.order.created`.
   *
   * Note: this route must appear BEFORE `/:id` to avoid capture by the
   * generic param route.
   */
  @Get('trigger/:type')
  findByTrigger(@Param('type') type: string): DefinitionListResponse {
    const data = this.registry.findByTrigger(type as TriggerType);
    return { success: true, total: data.length, data };
  }

  /**
   * POST /workflow/templates/validate
   * Validates a workflow definition without registering it.
   * Useful for UI template editors and CI checks.
   * Always returns HTTP 200 — check `data.valid` for the result.
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  validate(@Body() body: WorkflowDefinition): ValidationResponse {
    const result = this.registry.validate(body);
    return { success: true, data: result };
  }

  /**
   * GET /workflow/templates/:id
   * Returns a single template definition by its unique ID.
   */
  @Get(':id')
  findById(@Param('id') id: string): DefinitionResponse {
    const data = this.registry.findById(id);
    return { success: true, data };
  }
}
