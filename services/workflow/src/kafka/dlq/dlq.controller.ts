import {
  Controller,
  Get,
  Post,
  Param,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DlqService, DlqEntry } from './dlq.service';
import { WorkflowService } from '../../workflow/workflow.service';
import { WorkflowTopic } from '../constants/kafka.constants';

/**
 * DlqController exposes REST endpoints for inspecting and replaying
 * messages that exhausted all retry attempts and were routed to the DLQ.
 *
 * Routes (relative to workflow service root, proxied via /api/proxy/workflow):
 *   GET  /dlq           — list all DLQ entries, newest first
 *   POST /dlq/:id/retry — re-process a single DLQ entry through the workflow engine
 */
@Controller('dlq')
export class DlqController {
  constructor(
    private readonly dlqService: DlqService,
    private readonly workflowService: WorkflowService,
  ) {}

  /** List all failed messages currently in the DLQ store, newest first. */
  @Get()
  list(): DlqEntry[] {
    return this.dlqService.list();
  }

  /**
   * Manually retry a DLQ entry by re-submitting its payload to the
   * workflow engine via WorkflowService.handleEvent().
   *
   * Marks the entry with a retriedAt timestamp on success.
   */
  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  async retry(@Param('id') id: string): Promise<{ id: string; retriedAt: string; originalTopic: string }> {
    const entry = this.dlqService.get(id);
    if (!entry) throw new NotFoundException(`DLQ entry '${id}' not found`);

    await this.workflowService.handleEvent(
      entry.originalTopic as WorkflowTopic,
      entry.payload,
    );

    this.dlqService.markRetried(id);
    const retriedAt = new Date().toISOString();

    return { id, retriedAt, originalTopic: entry.originalTopic };
  }
}
