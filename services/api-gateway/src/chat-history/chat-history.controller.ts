import {
  Controller,
  Get,
  Post,
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
import { ChatHistoryService } from './chat-history.service';
import { CreateChatHistoryDto } from './dto/create-chat-history.dto';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/v1/chat-history')
export class ChatHistoryController {
  constructor(
    private readonly chatHistoryService: ChatHistoryService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: any,
    @Query('agentId') agentId?: string,
    @Query('channel') channel?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // Scope to authenticated user — users can only see their own chat history
    return this.chatHistoryService.list({
      agentId,
      userId: user.id,
      channel,
      search,
      from,
      to,
      page: parseInt(page ?? '1', 10) || 1,
      limit: parseInt(limit ?? '50', 10) || 50,
    });
  }

  @Post()
  async save(@Body() body: CreateChatHistoryDto, @CurrentUser() user: any, @Req() req: Request) {
    const record = await this.chatHistoryService.create({
      agentId: body.agentId,
      agentName: body.agentName,
      userId: user.id,
      userName: user.name ?? 'You',
      messages: body.messages,
      summary: body.summary,
      channel: body.channel,
    });

    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: 'create',
      resource: 'chat_history',
      resourceId: record.id,
      detail: `Saved chat history with agent ${body.agentName ?? body.agentId}`,
      ip: req.ip,
      success: true,
    });

    return record;
  }

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user: any) {
    const record = await this.chatHistoryService.findOne(id);
    if (record.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    return record;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const record = await this.chatHistoryService.findOne(id);
    if (record.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    await this.chatHistoryService.remove(id);

    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: 'delete',
      resource: 'chat_history',
      resourceId: id,
      detail: `Deleted chat history with agent ${record.agentName}`,
      ip: req.ip,
      success: true,
    });
  }
}
