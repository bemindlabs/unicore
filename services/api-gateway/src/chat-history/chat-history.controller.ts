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
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/chat-history')
export class ChatHistoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('agentId') agentId?: string,
    @Query('userId') userId?: string,
    @Query('channel') channel?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(parseInt(limit ?? '50', 10) || 50, 100);
    const skip = ((parseInt(page ?? '1', 10) || 1) - 1) * take;

    const where: any = {};
    if (agentId) where.agentId = agentId;
    if (userId) where.userId = userId;
    if (channel) where.channel = channel;
    if (search) {
      where.OR = [
        { agentName: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.chatHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.chatHistory.count({ where }),
    ]);

    return { items, total, page: Math.floor(skip / take) + 1, limit: take };
  }

  @Post()
  async save(@Body() body: any) {
    const { agentId, agentName, userId, userName, messages, summary, channel } = body;

    // Generate a summary from the first user message if not provided
    const autoSummary =
      summary ??
      (Array.isArray(messages)
        ? (messages.find((m: any) => m.authorId === 'human-user')?.text ?? '').slice(0, 120)
        : '');

    const record = await this.prisma.chatHistory.create({
      data: {
        agentId,
        agentName,
        userId: userId ?? 'user-1',
        userName: userName ?? 'You',
        messages: messages ?? [],
        summary: autoSummary || null,
        channel: channel ?? 'command',
      },
    });

    return record;
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const record = await this.prisma.chatHistory.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Chat history ${id} not found`);
    return record;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    const record = await this.prisma.chatHistory.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Chat history ${id} not found`);
    await this.prisma.chatHistory.delete({ where: { id } });
  }
}
