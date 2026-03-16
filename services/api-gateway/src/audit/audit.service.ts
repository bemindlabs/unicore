import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: {
    userId?: string;
    userEmail?: string;
    action: string;
    resource: string;
    resourceId?: string;
    detail?: string;
    ip?: string;
    success?: boolean;
  }) {
    try {
      await this.prisma.auditLog.create({ data: entry });
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }

  async query(options: {
    page?: number;
    limit?: number;
    action?: string;
    resource?: string;
    userId?: string;
    search?: string;
  }) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 500);
    const where: any = {};
    if (options.action) where.action = options.action;
    if (options.resource) where.resource = options.resource;
    if (options.userId) where.userId = options.userId;
    if (options.search) {
      where.OR = [
        { userEmail: { contains: options.search, mode: 'insensitive' } },
        { resource: { contains: options.search, mode: 'insensitive' } },
        { detail: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
