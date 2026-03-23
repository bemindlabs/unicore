import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ConversationsService } from './conversations.service';
import { ConversationsGateway } from './conversations.gateway';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { InviteParticipantDto, InviteCommandDto, UpdateParticipantDto } from './dto/invite-participant.dto';
import { UpdateConversationDto, TransitionStatusDto } from './dto/update-conversation.dto';
import { AddMessageDto } from './dto/add-message.dto';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/v1/conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly gateway: ConversationsGateway,
    private readonly audit: AuditService,
  ) {}

  // ─── Conversations CRUD ──────────────────────────────────────────────────────

  @Post()
  async create(@Body() dto: CreateConversationDto, @CurrentUser() user: any, @Req() req: Request) {
    const conversation = await this.conversationsService.create(user.id, dto);
    await this.audit.log({
      userId: user.id, userEmail: user.email, action: 'create', resource: 'conversations',
      resourceId: conversation.id, detail: `Created conversation: ${dto.title ?? dto.channel ?? 'web'}`,
      ip: req.ip, success: true,
    });
    this.gateway.emitConversationCreated(conversation);
    return conversation;
  }

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversationsService.list({
      userId: user.id, status, channel, assigneeId, search, from, to,
      page: parseInt(page ?? '1', 10) || 1,
      limit: parseInt(limit ?? '50', 10) || 50,
    });
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentUser() user: any) {
    const conversation = await this.conversationsService.findOne(id);
    if (conversation.userId !== user.id) throw new ForbiddenException('Access denied');
    return conversation;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateConversationDto, @CurrentUser() user: any, @Req() req: Request) {
    const existing = await this.conversationsService.findOne(id);
    if (existing.userId !== user.id) throw new ForbiddenException('Access denied');
    const updated = await this.conversationsService.update(id, dto);
    await this.audit.log({ userId: user.id, userEmail: user.email, action: 'update', resource: 'conversations', resourceId: id, detail: 'Updated conversation', ip: req.ip, success: true });
    this.gateway.emitConversationUpdated(id, updated);
    return updated;
  }

  @Post(':id/assign')
  async assign(
    @Param('id') id: string,
    @Body('assigneeId') assigneeId: string,
    @Body('assigneeName') assigneeName: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const existing = await this.conversationsService.findOne(id);
    if (existing.userId !== user.id) throw new ForbiddenException('Access denied');
    const updated = await this.conversationsService.assign(id, assigneeId, assigneeName);
    await this.audit.log({ userId: user.id, userEmail: user.email, action: 'update', resource: 'conversations', resourceId: id, detail: `Assigned conversation to ${assigneeName ?? assigneeId}`, ip: req.ip, success: true });
    this.gateway.emitConversationAssigned(id, assigneeId);
    return updated;
  }

  @Post(':id/transition')
  async transition(@Param('id') id: string, @Body() dto: TransitionStatusDto, @CurrentUser() user: any, @Req() req: Request) {
    const existing = await this.conversationsService.findOne(id);
    if (existing.userId !== user.id) throw new ForbiddenException('Access denied');
    const updated = await this.conversationsService.transition(id, dto.status);
    await this.audit.log({ userId: user.id, userEmail: user.email, action: 'update', resource: 'conversations', resourceId: id, detail: `Transitioned to ${dto.status}`, ip: req.ip, success: true });
    this.gateway.emitStatusChanged(id, dto.status);
    return updated;
  }

  @Get(':id/history')
  async getHistory(@Param('id') id: string, @CurrentUser() user: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    const existing = await this.conversationsService.findOne(id);
    if (existing.userId !== user.id) throw new ForbiddenException('Access denied');
    return this.conversationsService.getHistory(id, { page: parseInt(page ?? '1', 10) || 1, limit: parseInt(limit ?? '50', 10) || 50 });
  }

  @Post(':id/messages')
  async addMessage(@Param('id') id: string, @Body() dto: AddMessageDto, @CurrentUser() user: any, @Req() req: Request) {
    const existing = await this.conversationsService.findOne(id);
    if (existing.userId !== user.id) throw new ForbiddenException('Access denied');
    const message = await this.conversationsService.addMessage(id, user.id, dto);
    await this.audit.log({ userId: user.id, userEmail: user.email, action: 'create', resource: 'conversation_messages', resourceId: message.id, detail: `Added message to conversation ${id}`, ip: req.ip, success: true });
    this.gateway.emitMessageAdded(id, message);
    return message;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const existing = await this.conversationsService.findOne(id);
    if (existing.userId !== user.id) throw new ForbiddenException('Access denied');
    await this.conversationsService.remove(id);
    await this.audit.log({ userId: user.id, userEmail: user.email, action: 'delete', resource: 'conversations', resourceId: id, detail: 'Deleted conversation', ip: req.ip, success: true });
    this.gateway.emitConversationUpdated(id, { deleted: true });
  }

  // ─── Participants (UNC-1031) — Agent Assignment Panel ───────────────────────
  //
  // GET    /:id/participants       → list active participants with status indicators
  // POST   /:id/participants       → add agent or human (Add Agent button)
  // PATCH  /:id/participants/:pid  → toggle autoRespond / update colour
  // DELETE /:id/participants/:pid  → soft-remove (Remove Agent button)
  // POST   /:id/invite             → /invite @agentType command
  // POST   /:id/auto-assign        → auto-assign via Router Agent

  @Get(':id/participants')
  async listParticipants(@Param('id') id: string, @CurrentUser() user: any) {
    const conversation = await this.conversationsService.findOne(id);
    if (conversation.userId !== user.id) throw new ForbiddenException('Access denied');
    return this.conversationsService.listParticipants(id);
  }

  @Post(':id/participants')
  async addParticipant(@Param('id') id: string, @Body() dto: InviteParticipantDto, @CurrentUser() user: any, @Req() req: Request) {
    const conversation = await this.conversationsService.findOne(id);
    if (conversation.userId !== user.id) throw new ForbiddenException('Access denied');
    const participant = await this.conversationsService.inviteParticipant(id, dto, user.id);
    await this.audit.log({ userId: user.id, userEmail: user.email, action: 'create', resource: 'conversation_participants', resourceId: participant.id, detail: `Added ${dto.participantType} "${dto.participantName}" to conversation ${id}`, ip: req.ip, success: true });
    this.gateway.emitParticipantsUpdated(id, { action: 'added', participant });
    return participant;
  }

  /** Toggle autoRespond or update participantColor — core UNC-1031 feature */
  @Patch(':id/participants/:participantId')
  async updateParticipant(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @Body() dto: UpdateParticipantDto,
    @CurrentUser() user: any,
  ) {
    const conversation = await this.conversationsService.findOne(id);
    if (conversation.userId !== user.id) throw new ForbiddenException('Access denied');
    const updated = await this.conversationsService.updateParticipant(id, participantId, dto);
    this.gateway.emitParticipantsUpdated(id, { action: 'updated', participant: updated });
    return updated;
  }

  @Delete(':id/participants/:participantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeParticipant(@Param('id') id: string, @Param('participantId') participantId: string, @CurrentUser() user: any, @Req() req: Request) {
    const conversation = await this.conversationsService.findOne(id);
    if (conversation.userId !== user.id) throw new ForbiddenException('Access denied');
    const removed = await this.conversationsService.removeParticipant(id, participantId);
    await this.audit.log({ userId: user.id, userEmail: user.email, action: 'delete', resource: 'conversation_participants', resourceId: participantId, detail: `Removed participant "${participantId}" from conversation ${id}`, ip: req.ip, success: true });
    this.gateway.emitParticipantsUpdated(id, { action: 'removed', participantId });
    return removed;
  }

  @Post(':id/invite')
  async processInviteCommand(@Param('id') id: string, @Body() dto: InviteCommandDto, @CurrentUser() user: any) {
    const conversation = await this.conversationsService.findOne(id);
    if (conversation.userId !== user.id) throw new ForbiddenException('Access denied');
    const participant = await this.conversationsService.processInviteCommand(id, dto.command, user.id);
    this.gateway.emitParticipantsUpdated(id, { action: 'added', participant });
    return participant;
  }

  @Post(':id/auto-assign')
  async autoAssign(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const existing = await this.conversationsService.findOne(id);
    if (existing.userId !== user.id) throw new ForbiddenException('Access denied');
    const participant = await this.conversationsService.autoAssign(id, user.id);
    await this.audit.log({ userId: user.id, userEmail: user.email, action: 'create', resource: 'conversation_participants', resourceId: participant.id, detail: `Auto-assigned agent to conversation ${id}`, ip: req.ip, success: true });
    this.gateway.emitParticipantsUpdated(id, { action: 'added', participant });
    return participant;
  }
}
