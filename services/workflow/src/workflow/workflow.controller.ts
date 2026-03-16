/**
 * WorkflowController — REST endpoints for the workflow engine.
 *
 * Base path: / (proxied via /api/proxy/workflow)
 */
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { TriggerWorkflowDto } from '../dto/trigger-workflow.dto';
import { HandleEventDto } from '../dto/handle-event.dto';
import { RegisterDefinitionDto } from '../dto/register-definition.dto';

const PIPE = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });

@Controller()
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  // -----------------------------------------------------------------------
  // Definition endpoints
  // -----------------------------------------------------------------------

  @Post('definitions')
  @UsePipes(PIPE)
  registerDefinition(@Body() dto: RegisterDefinitionDto) {
    return this.workflowService.registerDefinition(dto);
  }

  @Get('definitions')
  listDefinitions() {
    return this.workflowService.listDefinitions();
  }

  @Get('definitions/:id')
  getDefinition(@Param('id') id: string) {
    return this.workflowService.getDefinition(id);
  }

  @Delete('definitions/:id')
  @HttpCode(HttpStatus.OK)
  removeDefinition(@Param('id') id: string) {
    return this.workflowService.removeDefinition(id);
  }

  // -----------------------------------------------------------------------
  // Execution endpoints
  // -----------------------------------------------------------------------

  @Post('trigger')
  @UsePipes(PIPE)
  trigger(@Body() dto: TriggerWorkflowDto) {
    return this.workflowService.trigger(dto.workflowId, dto.payload ?? {});
  }

  @Post('events')
  @UsePipes(PIPE)
  handleEvent(@Body() dto: HandleEventDto) {
    return this.workflowService.handleEvent(dto.eventType, dto.payload ?? {});
  }

  // -----------------------------------------------------------------------
  // Instance endpoints
  // -----------------------------------------------------------------------

  @Get('instances')
  listInstances() {
    return this.workflowService.listInstances();
  }

  @Get('instances/:instanceId')
  getInstance(@Param('instanceId') instanceId: string) {
    return this.workflowService.getInstance(instanceId);
  }

  @Get('definitions/:id/instances')
  listInstancesByWorkflow(@Param('id') id: string) {
    return this.workflowService.listInstancesByWorkflow(id);
  }
}
