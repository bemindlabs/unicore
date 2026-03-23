import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { HandoffService } from './handoff.service';
import { CreateHandoffDto, ClaimHandoffDto } from './dto/handoff.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('api/v1/handoffs')
export class HandoffController {
  constructor(private readonly handoffService: HandoffService) {}

  /** List handoffs — operators see their queue, filtered by status */
  @Get()
  async list(
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.handoffService.list({
      status,
      assignedTo,
      userId,
      page: parseInt(page ?? '1', 10) || 1,
      limit: parseInt(limit ?? '50', 10) || 50,
    });
  }

  /** Create a new handoff escalation (called by OpenClaw gateway) */
  @Post()
  async create(@Body() dto: CreateHandoffDto) {
    return this.handoffService.create(dto);
  }

  /** Get a specific handoff */
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.handoffService.findById(id);
  }

  /** Get the active handoff for a channel/session (used by dashboard UI) */
  @Get('channel/:channel')
  async getByChannel(@Param('channel') channel: string) {
    const decoded = decodeURIComponent(channel);
    const handoff = await this.handoffService.findActiveForChannel(decoded);
    return { handoff: handoff ?? null };
  }

  /** Human operator claims the handoff */
  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  async claim(@Param('id') id: string, @Body() dto: ClaimHandoffDto) {
    return this.handoffService.claim(id, dto.operatorId);
  }

  /** Human operator marks as resolved */
  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolve(@Param('id') id: string) {
    return this.handoffService.resolve(id);
  }

  /** Human operator lets AI resume ("Let AI Handle" button) */
  @Post(':id/resume-ai')
  @HttpCode(HttpStatus.OK)
  async resumeAI(@Param('id') id: string) {
    return this.handoffService.resumeAI(id);
  }

  /** Trigger SLA breach check (can be called by a cron / health endpoint) */
  @Post('sla/check')
  @HttpCode(HttpStatus.OK)
  @Public()
  async checkSla() {
    const breached = await this.handoffService.markSlaBreaches();
    return { breached };
  }
}
