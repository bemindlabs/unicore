import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  Res,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConversationIntelligenceService } from './conversation-intelligence.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/v1/chat-history')
export class ConversationIntelligenceController {
  constructor(
    private readonly intelligenceService: ConversationIntelligenceService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id/intelligence')
  async getIntelligence(@Param('id') id: string, @CurrentUser() user: any) {
    const record = await this.prisma.chatHistory.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Chat history ${id} not found`);
    if (record.userId !== user.id) throw new ForbiddenException('Access denied');
    const intel = await this.intelligenceService.getIntelligence(id);
    return intel ?? { chatHistoryId: id, analyzed: false };
  }

  @Post(':id/intelligence/analyze')
  async analyze(@Param('id') id: string, @CurrentUser() user: any) {
    const record = await this.prisma.chatHistory.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Chat history ${id} not found`);
    if (record.userId !== user.id) throw new ForbiddenException('Access denied');
    return this.intelligenceService.analyze(id);
  }

  @Get(':id/intelligence/stream')
  async stream(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const record = await this.prisma.chatHistory.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Chat history ${id} not found`);
    if (record.userId !== user.id) throw new ForbiddenException('Access denied');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const subject = this.intelligenceService.getOrCreateStream(id);
    const sub = subject.subscribe({
      next: (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      },
      error: () => res.end(),
    });

    req.on('close', () => {
      sub.unsubscribe();
      this.intelligenceService.removeStream(id);
    });
  }
}
