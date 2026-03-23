import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpsertContactChannelDto } from './dto/upsert-contact-channel.dto';
import { ConversationsGateway } from './conversations.gateway';

@Controller('api/v1/conversations')
export class ConversationsController {
  constructor(
    private readonly service: ConversationsService,
    private readonly gateway: ConversationsGateway,
  ) {}

  // ─── Conversations ────────────────────────────────────────────────────────

  @Get()
  list(
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
  ) {
    return this.service.list({ channel, status, assigneeId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateConversationDto) {
    return this.service.create(dto);
  }

  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body('assigneeId') assigneeId: string | null) {
    return this.service.assign(id, assigneeId ?? null);
  }

  @Patch(':id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolve(@Param('id') id: string) {
    const conv = await this.service.resolve(id);
    this.gateway.emitConversationUpdate(id, { status: conv.status });
    return conv;
  }

  @Patch(':id/close')
  @HttpCode(HttpStatus.OK)
  async close(@Param('id') id: string) {
    const conv = await this.service.close(id);
    this.gateway.emitConversationUpdate(id, { status: conv.status });
    return conv;
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  @Get(':id/messages')
  listMessages(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listMessages(id, cursor, limit ? parseInt(limit, 10) : 50);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.service.sendMessage(id, dto, 'OUTBOUND');
    this.gateway.emitMessage(id, message);
    return message;
  }

  @Patch(':id/messages/:msgId/read')
  @HttpCode(HttpStatus.OK)
  markRead(@Param('id') id: string, @Param('msgId') msgId: string) {
    return this.service.markRead(id, msgId);
  }

  // ─── Participants ─────────────────────────────────────────────────────────

  @Post(':id/participants')
  addParticipant(
    @Param('id') id: string,
    @Body('userId') userId: string,
    @Body('role') role?: string,
  ) {
    return this.service.addParticipant(id, userId, role);
  }

  @Patch(':id/participants/:userId/leave')
  @HttpCode(HttpStatus.OK)
  removeParticipant(@Param('id') id: string, @Param('userId') userId: string) {
    return this.service.removeParticipant(id, userId);
  }

  // ─── ContactChannels ──────────────────────────────────────────────────────

  @Get('/contact-channels')
  listContactChannels(@Query('channel') channel?: string) {
    return this.service.listContactChannels(channel);
  }

  @Post('/contact-channels')
  upsertContactChannel(@Body() dto: UpsertContactChannelDto) {
    return this.service.upsertContactChannel(dto);
  }
}
