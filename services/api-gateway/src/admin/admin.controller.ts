import { Controller, Get, Patch, Param, Body, Query, Logger, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TokenBlacklistService } from '../auth/token-blacklist.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { LicenseGuard } from '../license/guards/license.guard';
import { ProFeatureRequired } from '../license/decorators/pro-feature.decorator';

@Roles('OWNER')
@Controller('api/v1/admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {}

  @Get('users')
  async listUsers() {
    const users = await this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return users;
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id') userId: string,
    @Body('role') newRole: string,
  ) {
    const validRoles = ['OWNER', 'OPERATOR', 'MARKETER', 'FINANCE', 'VIEWER'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: { id: true, email: true, name: true, role: true },
    });

    // Invalidate all active sessions for this user so their JWT (with old role) cannot be reused
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      select: { id: true, token: true },
    });

    for (const session of sessions) {
      try {
        // Decode the access token to extract jti for blacklisting
        const tokenParts = session.token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
          if (payload.jti) {
            const now = Math.floor(Date.now() / 1000);
            const ttl = payload.exp ? payload.exp - now : 900;
            if (ttl > 0) {
              await this.tokenBlacklist.blacklist(payload.jti, ttl);
            }
          }
        }
      } catch {
        // Token may be malformed; continue to delete the session anyway
      }
    }

    // Delete all sessions to force re-login
    await this.prisma.session.deleteMany({ where: { userId } });

    this.logger.log(`Role updated for user ${user.email}: ${newRole} — ${sessions.length} session(s) invalidated`);

    return user;
  }

  @Get('audit-logs')
  @ProFeatureRequired('auditLogs')
  @UseGuards(LicenseGuard)
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
