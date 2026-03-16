import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/tasks')
export class TasksController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('status') status?: string) {
    const where = status ? { status } : {};
    const rows = await this.prisma.task.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    // Map DB rows to the BoardTask shape the dashboard expects
    const tasks = rows.map((r) => this.toBoard(r));
    return { tasks };
  }

  @Post()
  async create(@Body() body: any) {
    const { assignee, comments, activity, ...rest } = body;

    const data: any = {
      ...rest,
      assigneeId: assignee?.id ?? null,
      assigneeType: assignee?.type ?? null,
      assigneeName: assignee?.name ?? null,
      assigneeColor: assignee?.color ?? null,
    };

    // Remove fields Prisma generates
    delete data.updatedAt;

    const row = await this.prisma.task.create({ data });
    return this.toBoard(row);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Task ${id} not found`);

    const { assignee, comments, activity, ...rest } = body;

    const data: any = { ...rest };
    if (assignee !== undefined) {
      data.assigneeId = assignee?.id ?? null;
      data.assigneeType = assignee?.type ?? null;
      data.assigneeName = assignee?.name ?? null;
      data.assigneeColor = assignee?.color ?? null;
    }

    // Remove read-only fields
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;

    const row = await this.prisma.task.update({ where: { id }, data });
    return this.toBoard(row);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Task ${id} not found`);
    await this.prisma.task.delete({ where: { id } });
  }

  @Post(':id/comments')
  async addComment(@Param('id') id: string, @Body() _body: any) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Task ${id} not found`);
    return { ok: true };
  }

  /** Map a Prisma Task row to the BoardTask shape the dashboard expects */
  private toBoard(row: any) {
    const {
      assigneeId,
      assigneeType,
      assigneeName,
      assigneeColor,
      completedAt,
      createdAt,
      updatedAt,
      ...rest
    } = row;

    return {
      ...rest,
      assignee:
        assigneeId
          ? { id: assigneeId, type: assigneeType, name: assigneeName, color: assigneeColor }
          : undefined,
      completedAt: completedAt?.toISOString() ?? undefined,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      comments: [],
      activity: [],
    };
  }
}
