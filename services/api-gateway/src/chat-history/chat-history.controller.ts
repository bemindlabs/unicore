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
} from '@nestjs/common';
import { Request } from 'express';
import { ChatHistoryService } from './chat-history.service';
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
    @CurrentUser() _user: any,
    @Query('agentId') agentId?: string,
    @Query('userId') userId?: string,
    @Query('channel') channel?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatHistoryService.list({
      agentId,
      userId,
      channel,
      search,
      from,
      to,
      page: parseInt(page ?? '1', 10) || 1,
      limit: parseInt(limit ?? '50', 10) || 50,
    });
  }

  @Post()
  async save(@Body() body: any, @CurrentUser() user: any, @Req() req: Request) {
    const { agentId, agentName, userId, userName, messages, summary, channel } = body;

    const record = await this.chatHistoryService.create({
      agentId,
      agentName,
      userId: userId ?? user?.id ?? 'user-1',
      userName: userName ?? user?.name ?? 'You',
      messages,
      summary,
      channel,
    });

    await this.audit.log({
      userId: user?.id,
      userEmail: user?.email,
      action: 'create',
      resource: 'chat_history',
      resourceId: record.id,
      detail: `Saved chat history with agent ${agentName ?? agentId}`,
      ip: req.ip,
      success: true,
    });

    return record;
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.chatHistoryService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const record = await this.chatHistoryService.remove(id);

    await this.audit.log({
      userId: user?.id,
      userEmail: user?.email,
      action: 'delete',
      resource: 'chat_history',
      resourceId: id,
      detail: `Deleted chat history with agent ${record.agentName}`,
      ip: req.ip,
      success: true,
    });
  }
}
