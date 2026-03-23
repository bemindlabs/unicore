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
    const now = new Date().toISOString();
    const services: Array<{ name: string; status: string; latencyMs?: number; lastCheckedAt: string; errorMessage?: string }> = [];

    const checkService = async (name: string, url: string) => {
      const t = Date.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        services.push({ name, status: res.ok ? 'healthy' : 'degraded', latencyMs: Date.now() - t, lastCheckedAt: now });
      } catch (err: any) {
        services.push({ name, status: 'down', latencyMs: Date.now() - t, lastCheckedAt: now, errorMessage: err?.message ?? 'Connection failed' });
      }
    };

    // Check database
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      services.push({ name: 'PostgreSQL', status: 'HEALTHY', latencyMs: Date.now() - dbStart, lastCheckedAt: now });
    } catch (err: any) {
      services.push({ name: 'PostgreSQL', status: 'UNHEALTHY', latencyMs: Date.now() - dbStart, lastCheckedAt: now, errorMessage: err?.message });
    }

    // Check services in parallel
    const erpHost = process.env.ERP_SERVICE_HOST ?? 'localhost';
    const erpPort = process.env.ERP_SERVICE_PORT ?? '4100';
    const ocHost = process.env.OPENCLAW_SERVICE_HOST ?? 'localhost';
    const ocPort = process.env.OPENCLAW_SERVICE_PORT ?? '18790';
    const ragHost = process.env.RAG_SERVICE_HOST ?? 'localhost';
    const ragPort = process.env.RAG_SERVICE_PORT ?? '4300';
    const aiHost = process.env.AI_ENGINE_SERVICE_HOST ?? 'localhost';
    const aiPort = process.env.AI_ENGINE_SERVICE_PORT ?? '4200';

    await Promise.all([
      checkService('ERP Service', `http://${erpHost}:${erpPort}/api/v1/health`),
      checkService('OpenClaw Gateway', `http://${ocHost}:${ocPort}/health`),
      checkService('RAG Service', `http://${ragHost}:${ragPort}/health`),
      checkService('AI Engine', `http://${aiHost}:${aiPort}/api/v1/llm/health`),
    ]);

    const hasUnhealthy = services.some(s => s.status === 'UNHEALTHY');
    const hasDegraded = services.some(s => s.status === 'DEGRADED');
    const overallStatus = hasUnhealthy ? 'DEGRADED' : hasDegraded ? 'DEGRADED' : 'HEALTHY';

    const uptimeSec = Math.floor(process.uptime());
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const usedMem = totalMem - os.freemem();

    const clusterNodes = [
      {
        nodeId: os.hostname(),
        host: os.hostname(),
        role: 'primary' as const,
        status: overallStatus,
        cpuPercent: Math.round(os.loadavg()[0] / cpus.length * 100),
        memoryPercent: Math.round((usedMem / totalMem) * 100),
        uptime: uptimeSec,
      },
    ];

    return { overallStatus, services, clusterNodes, checkedAt: now };
  }

  // ─── Platform Overview ──────────────────────────────────────────────────

  @Get('overview')
  async overview() {
    const [userCount, sessionCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.session.count(),
    ]);

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsersThisWeek = await this.prisma.user.count({
      where: { createdAt: { gte: oneWeekAgo } },
    });

    const uptimeSeconds = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);

    return {
      tenantCount: 1,
      activeTenantCount: 1,
      totalUserCount: userCount,
      activeSessionCount: sessionCount,
      storageUsageBytes: 0,
      apiCallsToday: 0,
      apiCallsThisMonth: 0,
      newTenantsThisWeek: 0,
      newUsersThisWeek,
      uptime: uptimeSeconds,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Tenant Management ──────────────────────────────────────────────────

  @Get('tenants')
  async listTenants(@Query() query: any) {
    const page = query.page ? parseInt(query.page) : 1;
    const limit = query.limit ? parseInt(query.limit) : 20;

    const [userCount, _sessionCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.session.count(),
    ]);

    const tenant = {
      id: 'tenant-bemind-001',
      name: 'Bemind Technology Co., Ltd.',
      slug: 'bemind',
      displayName: 'Bemind Technology',
      customDomain: 'labs.bemind.tech',
      plan: 'ENTERPRISE' as const,
      status: 'ACTIVE' as const,
      ownerEmail: 'info@bemind.tech',
      memberCount: userCount,
      storageUsageBytes: 0,
      apiCallsThisMonth: 0,
      createdAt: this.startedAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const search = query.search?.toLowerCase();
    const statusFilter = query.status;
    const planFilter = query.plan;

    let items = [tenant];

    if (search && !tenant.name.toLowerCase().includes(search) && !tenant.slug.includes(search)) {
      items = [];
    }
    if (statusFilter && tenant.status !== statusFilter) {
      items = [];
    }
    if (planFilter && tenant.plan !== planFilter) {
      items = [];
    }

    return {
      items,
      total: items.length,
      page,
      limit,
    };
  }

  @Post('tenants/:id/suspend')
  async suspendTenant(@Param('id') id: string, @Body() body: any) {
    this.logger.warn(`Tenant suspend requested: ${id} — reason: ${body?.reason ?? 'none'}`);
    return {
      id,
      name: 'Bemind Technology Co., Ltd.',
      slug: 'bemind',
      plan: 'ENTERPRISE',
      status: 'SUSPENDED',
      ownerEmail: 'info@bemind.tech',
      memberCount: 0,
      storageUsageBytes: 0,
      apiCallsThisMonth: 0,
      createdAt: this.startedAt.toISOString(),
      updatedAt: new Date().toISOString(),
      suspendedAt: new Date().toISOString(),
      suspendReason: body?.reason ?? 'Administrative action',
    };
  }

  @Post('tenants/:id/activate')
  async activateTenant(@Param('id') id: string) {
    this.logger.log(`Tenant activate requested: ${id}`);
    return {
      id,
      name: 'Bemind Technology Co., Ltd.',
      slug: 'bemind',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      ownerEmail: 'info@bemind.tech',
      memberCount: 0,
      storageUsageBytes: 0,
      apiCallsThisMonth: 0,
      createdAt: this.startedAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // ─── Platform Settings ──────────────────────────────────────────────────

  @Get('settings')
  getSettings() {
    return this.platformSettings;
  }

  @Patch('settings')
  updateSettings(@Body() body: any, @CurrentUser() currentUser: any) {
    if (body.defaultPlan !== undefined) this.platformSettings.defaultPlan = body.defaultPlan;
    if (body.allowedPlans !== undefined) this.platformSettings.allowedPlans = body.allowedPlans;
    if (body.defaultUserQuota !== undefined) this.platformSettings.defaultUserQuota = body.defaultUserQuota;
    if (body.defaultStorageQuotaBytes !== undefined) this.platformSettings.defaultStorageQuotaBytes = body.defaultStorageQuotaBytes;
    if (body.defaultApiCallQuotaPerDay !== undefined) this.platformSettings.defaultApiCallQuotaPerDay = body.defaultApiCallQuotaPerDay;
    if (body.maintenanceMode !== undefined) this.platformSettings.maintenanceMode = body.maintenanceMode;
    if (body.registrationEnabled !== undefined) this.platformSettings.registrationEnabled = body.registrationEnabled;
    if (body.featureToggles !== undefined) {
      this.platformSettings.featureToggles = { ...this.platformSettings.featureToggles, ...body.featureToggles };
    }
    this.platformSettings.updatedAt = new Date().toISOString();
    this.platformSettings.updatedBy = currentUser?.email ?? 'system';

    this.logger.log(`Platform settings updated by ${this.platformSettings.updatedBy}`);
    return this.platformSettings;
  }

  // ─── System Metrics ─────────────────────────────────────────────────────

  @Get('metrics')
  async metrics() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const loadAvg = os.loadavg();

    let dbConnections = 0;
    try {
      const result: any[] = await this.prisma.$queryRaw`SELECT count(*)::int as count FROM pg_stat_activity WHERE state = 'active'`;
      dbConnections = result[0]?.count ?? 0;
    } catch { /* ignore */ }

    let dbMaxConnections = 100;
    try {
      const result: any[] = await this.prisma.$queryRaw`SHOW max_connections`;
      dbMaxConnections = parseInt(result[0]?.max_connections ?? '100');
    } catch { /* ignore */ }

    const dbLatencyStart = Date.now();
    try { await this.prisma.$queryRaw`SELECT 1`; } catch { /* ignore */ }
    const dbLatency = Date.now() - dbLatencyStart;

    return {
      cpu: {
        usagePercent: Math.round(loadAvg[0] / cpus.length * 100),
        coreCount: cpus.length,
        loadAvg: loadAvg as [number, number, number],
      },
      memory: {
        totalBytes: totalMem,
        usedBytes: usedMem,
        freeBytes: freeMem,
        usagePercent: Math.round((usedMem / totalMem) * 100),
      },
      disk: {
        totalBytes: 0,
        usedBytes: 0,
        freeBytes: 0,
        usagePercent: 0,
      },
      network: {
        activeConnections: 0,
        bytesInPerSecond: 0,
        bytesOutPerSecond: 0,
      },
      database: {
        activeConnections: dbConnections,
        maxConnections: dbMaxConnections,
        queryLatencyP99Ms: dbLatency,
      },
      collectedAt: new Date().toISOString(),
    };
  }
}
