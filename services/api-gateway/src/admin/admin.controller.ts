import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Logger, UseGuards, HttpCode, HttpStatus, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TokenBlacklistService } from '../auth/token-blacklist.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LicenseGuard } from '../license/guards/license.guard';
import { ProFeatureRequired } from '../license/decorators/pro-feature.decorator';
import * as os from 'os';

@Roles('OWNER')
@Controller('api/v1/admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);
  private readonly startedAt = new Date();
  private platformSettings = {
    defaultPlan: 'STARTER' as const,
    allowedPlans: ['STARTER', 'GROWTH', 'ENTERPRISE', 'CUSTOM'] as string[],
    defaultUserQuota: 10,
    defaultStorageQuotaBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    defaultApiCallQuotaPerDay: 10000,
    maintenanceMode: false,
    registrationEnabled: true,
    featureToggles: {
      sso: true,
      whiteLabel: true,
      advancedWorkflows: true,
      allChannels: true,
      customDomains: true,
      advancedAnalytics: true,
      prioritySupport: true,
      dlcChat: true,
      geekMode: true,
    } as Record<string, boolean>,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  };

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
    @CurrentUser() currentUser: any,
  ) {
    const validRoles = ['OWNER', 'OPERATOR', 'MARKETER', 'FINANCE', 'VIEWER'];
    if (!validRoles.includes(newRole)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Prevent self-demotion
    if (userId === currentUser.id) {
      throw new BadRequestException('Cannot change your own role');
    }

    // Prevent removing last OWNER
    const targetUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (targetUser?.role === 'OWNER' && newRole !== 'OWNER') {
      const ownerCount = await this.prisma.user.count({ where: { role: 'OWNER' } });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot demote the last owner account');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole as any },
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

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
  ) {
    // Prevent self-deletion
    if (userId === currentUser.id) {
      throw new BadRequestException('Cannot delete your own account');
    }

    // Check user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent deleting last OWNER
    if (user.role === 'OWNER') {
      const ownerCount = await this.prisma.user.count({ where: { role: 'OWNER' } });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot delete the last owner account');
      }
    }

    // Clean up orphaned data
    await this.prisma.chatHistory.deleteMany({ where: { userId } });
    await this.prisma.task.updateMany({
      where: { assigneeId: userId },
      data: { assigneeId: null, assigneeName: null, assigneeType: null, assigneeColor: null },
    });

    // Delete user (sessions cascade automatically via Prisma)
    await this.prisma.user.delete({ where: { id: userId } });

    // Audit log
    await this.auditService.log({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'delete',
      resource: 'users',
      resourceId: userId,
      detail: `Deleted user ${user.email}`,
    });

    this.logger.log(`User ${user.email} deleted by ${currentUser.email}`);
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
      const res = await fetch(`http://${erpHost}:${erpPort}/api/v1/health`, { signal: AbortSignal.timeout(3000) });
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
