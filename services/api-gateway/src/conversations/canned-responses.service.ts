import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCannedResponseDto, UpdateCannedResponseDto } from './dto/canned-response.dto';

@Injectable()
export class CannedResponsesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: { search?: string; category?: string; limit?: number }) {
    const take = Math.min(options.limit ?? 50, 200);
    const where: any = {};
    if (options.category) where.category = options.category;
    if (options.search) {
      where.OR = [
        { shortcut: { contains: options.search, mode: 'insensitive' } },
        { text: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.cannedResponse.findMany({
        where,
        orderBy: { shortcut: 'asc' },
        take,
      }),
      this.prisma.cannedResponse.count({ where }),
    ]);

    return { items, total };
  }

  async create(dto: CreateCannedResponseDto, userId: string) {
    const existing = await this.prisma.cannedResponse.findUnique({
      where: { shortcut: dto.shortcut },
    });
    if (existing) {
      throw new ConflictException(`Shortcut "/${dto.shortcut}" is already in use`);
    }

    return this.prisma.cannedResponse.create({
      data: {
        shortcut: dto.shortcut.replace(/^\//, '').toLowerCase().trim(),
        text: dto.text,
        category: dto.category ?? null,
        createdBy: userId,
      },
    });
  }

  async update(id: string, dto: UpdateCannedResponseDto) {
    await this.findOne(id);

    if (dto.shortcut) {
      const conflict = await this.prisma.cannedResponse.findFirst({
        where: { shortcut: dto.shortcut.replace(/^\//, '').toLowerCase().trim(), NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(`Shortcut "/${dto.shortcut}" is already in use`);
      }
    }

    return this.prisma.cannedResponse.update({
      where: { id },
      data: {
        ...(dto.shortcut !== undefined && {
          shortcut: dto.shortcut.replace(/^\//, '').toLowerCase().trim(),
        }),
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.category !== undefined && { category: dto.category }),
      },
    });
  }

  async findOne(id: string) {
    const record = await this.prisma.cannedResponse.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Canned response ${id} not found`);
    return record;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.cannedResponse.delete({ where: { id } });
  }
}
