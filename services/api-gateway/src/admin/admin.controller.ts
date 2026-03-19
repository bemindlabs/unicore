import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Roles('OWNER')
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Get('users')
  async listUsers() {
    const users = await this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return users;
  }

  @Get('audit-logs')
  async auditLogs(@Query() query: any) {
    return this.auditService.query({
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 50,
      action: query.action,
      resource: query.resource,
      search: query.search,
    });
  }

  @Get('health')
  async health() {
    const start = Date.now();
    const services = [];

    // Check database
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      services.push({ name: 'PostgreSQL', status: 'healthy', latencyMs: Date.now() - dbStart });
    } catch {
      services.push({ name: 'PostgreSQL', status: 'down', latencyMs: Date.now() - dbStart });
    }

    // Check ERP service
    const erpHost = process.env.ERP_SERVICE_HOST ?? 'localhost';
    const erpPort = process.env.ERP_SERVICE_PORT ?? '4100';
    try {
      const erpStart = Date.now();
      const res = await fetch(`http://${erpHost}:${erpPort}/health`, { signal: AbortSignal.timeout(3000) });
      services.push({ name: 'ERP Service', status: res.ok ? 'healthy' : 'degraded', latencyMs: Date.now() - erpStart });
    } catch {
      services.push({ name: 'ERP Service', status: 'down' });
    }

    // Check OpenClaw
    const ocHost = process.env.OPENCLAW_SERVICE_HOST ?? 'localhost';
    const ocPort = process.env.OPENCLAW_SERVICE_PORT ?? '18790';
    try {
      const ocStart = Date.now();
      const res = await fetch(`http://${ocHost}:${ocPort}/health`, { signal: AbortSignal.timeout(3000) });
      services.push({ name: 'OpenClaw Gateway', status: res.ok ? 'healthy' : 'degraded', latencyMs: Date.now() - ocStart });
    } catch {
      services.push({ name: 'OpenClaw Gateway', status: 'down' });
    }

    // Check RAG
    const ragHost = process.env.RAG_SERVICE_HOST ?? 'localhost';
    const ragPort = process.env.RAG_SERVICE_PORT ?? '4300';
    try {
      const ragStart = Date.now();
      const res = await fetch(`http://${ragHost}:${ragPort}/health`, { signal: AbortSignal.timeout(3000) });
      services.push({ name: 'RAG Service', status: res.ok ? 'healthy' : 'degraded', latencyMs: Date.now() - ragStart });
    } catch {
      services.push({ name: 'RAG Service', status: 'down' });
    }

    // Check AI Engine
    const aiHost = process.env.AI_ENGINE_SERVICE_HOST ?? 'localhost';
    const aiPort = process.env.AI_ENGINE_SERVICE_PORT ?? '4200';
    try {
      const aiStart = Date.now();
      const res = await fetch(`http://${aiHost}:${aiPort}/api/v1/llm/health`, { signal: AbortSignal.timeout(3000) });
      services.push({ name: 'AI Engine', status: res.ok ? 'healthy' : 'degraded', latencyMs: Date.now() - aiStart });
    } catch {
      services.push({ name: 'AI Engine', status: 'down' });
    }

    // Process uptime
    const uptime = Math.floor(process.uptime());

    return { services, uptime, timestamp: new Date().toISOString(), totalMs: Date.now() - start };
  }
}
