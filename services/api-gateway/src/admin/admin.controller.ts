import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Logger, UseGuards, HttpCode, HttpStatus, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TokenBlacklistService } from '../auth/token-blacklist.service';
import { LicenseService } from '../license/license.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LicenseGuard } from '../license/guards/license.guard';
import { ProFeatureRequired } from '../license/decorators/pro-feature.decorator';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { TenantUsageService } from '../common/tenancy/tenant-usage.service';
import * as os from 'os';

// GAPS #2/L1: SuperAdminGuard (User.isSuperAdmin) is the control-plane boundary.
// The former `@Roles('OWNER')` shadowed it — the global RolesGuard requires
// user.role === 'OWNER', so a Bemind super-admin whose role in their active
// tenant is not OWNER would be wrongly rejected. SuperAdminGuard is strictly
// stronger, so the role check is dropped as redundant.
@UseGuards(SuperAdminGuard)
@Controller('api/v1/admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);
  private readonly startedAt = new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly tokenBlacklist: TokenBlacklistService,
    private readonly licenseService: LicenseService,
    private readonly tenantUsage: TenantUsageService,
  ) {}

  /**
   * Returns the persisted platform settings from the Settings table, merging
   * in live feature toggles from the LicenseService so no toggle can be
   * hardcoded to true independently of the validated license edition.
   */
  private async getPlatformSettings(): Promise<{
    defaultPlan: string;
    allowedPlans: string[];
    defaultUserQuota: number;
    defaultStorageQuotaBytes: number;
    defaultApiCallQuotaPerDay: number;
    maintenanceMode: boolean;
    registrationEnabled: boolean;
    featureToggles: Record<string, boolean>;
    updatedAt: string;
    updatedBy: string;
  }> {
    // Load persisted admin overrides from the Settings table (key: 'platform-admin')
    let stored: Record<string, any> = {};
    try {
      const row = await this.prisma.settings.findUnique({ where: { id: 'platform-admin' } });
      if (row?.data && typeof row.data === 'object') {
        stored = row.data as Record<string, any>;
      }
    } catch {
      // Table may not exist on fresh installs — fall back to defaults silently
    }

    // Feature toggles are derived exclusively from the live license status.
    // No toggle can be true unless the validated license edition grants it.
    const [
      sso,
      whiteLabel,
      advancedWorkflows,
      allChannels,
      customDomains,
      advancedAnalytics,
      prioritySupport,
    ] = await Promise.all([
      this.licenseService.hasFeature('sso'),
      this.licenseService.hasFeature('whiteLabelBranding'),
      this.licenseService.hasFeature('advancedWorkflows'),
      this.licenseService.hasFeature('allChannels'),
      this.licenseService.hasFeature('allChannels'),
      this.licenseService.hasFeature('auditLogs'),
      this.licenseService.hasFeature('prioritySupport'),
    ]);

    const featureToggles: Record<string, boolean> = {
      sso,
      whiteLabel,
      advancedWorkflows,
      allChannels,
      customDomains,
      advancedAnalytics,
      prioritySupport,
    };

    // Quotas and plan config: prefer persisted DB values, then env vars, then
    // compile-time defaults. This follows the 12-factor config principle.
    const defaultPlan =
      (stored.defaultPlan as string | undefined) ??
      (process.env.PLATFORM_DEFAULT_PLAN ?? 'STARTER');

    const allowedPlans =
      (stored.allowedPlans as string[] | undefined) ??
      ['STARTER', 'GROWTH', 'ENTERPRISE', 'CUSTOM'];

    const defaultUserQuota =
      (stored.defaultUserQuota as number | undefined) ??
      parseInt(process.env.PLATFORM_DEFAULT_USER_QUOTA ?? '10', 10);

    const defaultStorageQuotaBytes =
      (stored.defaultStorageQuotaBytes as number | undefined) ??
      parseInt(process.env.PLATFORM_DEFAULT_STORAGE_BYTES ?? String(5 * 1024 * 1024 * 1024), 10);

    const defaultApiCallQuotaPerDay =
      (stored.defaultApiCallQuotaPerDay as number | undefined) ??
      parseInt(process.env.PLATFORM_DEFAULT_API_QUOTA_PER_DAY ?? '10000', 10);

    const maintenanceMode = (stored.maintenanceMode as boolean | undefined) ?? false;
    const registrationEnabled = (stored.registrationEnabled as boolean | undefined) ?? true;
    const updatedAt = (stored.updatedAt as string | undefined) ?? new Date().toISOString();
    const updatedBy = (stored.updatedBy as string | undefined) ?? 'system';

    return {
      defaultPlan,
      allowedPlans,
      defaultUserQuota,
      defaultStorageQuotaBytes,
      defaultApiCallQuotaPerDay,
      maintenanceMode,
      registrationEnabled,
      featureToggles,
      updatedAt,
      updatedBy,
    };
  }

  /**
   * Maps a real `Tenant` row to the control-plane tenant DTO consumed by the
   * platform-admin frontend. Enriches the row with the live member count and the
   * earliest OWNER's email (both real queries). Per-tenant `storageUsageBytes`
   * is reported as 0. `apiCallsThisMonth` is the LIVE per-tenant monthly usage
   * counter (FU-04), read from TenantUsageService (Redis-backed, the same
   * counter TenantRateLimitGuard enforces the plan cap against). The DTO shape
   * is preserved for the frontend.
   */
  private async mapTenantRecord(tenant: {
    id: string;
    slug: string;
    name: string;
    status: string;
    plan: string;
    customDomain: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<Record<string, any>> {
    const [memberCount, owner, apiCallsThisMonth] = await Promise.all([
      this.prisma.user.count({ where: { tenantId: tenant.id } }),
      this.prisma.user.findFirst({
        where: { tenantId: tenant.id, role: 'OWNER' },
        select: { email: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.tenantUsage.current(tenant.id),
    ]);

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      displayName: tenant.name,
      customDomain: tenant.customDomain ?? null,
      plan: tenant.plan,
      status: tenant.status,
      ownerEmail: owner?.email ?? null,
      memberCount,
      storageUsageBytes: 0,
      apiCallsThisMonth,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
    };
  }

  /**
   * Revokes every active session for a user: blacklists each session's JWT jti
   * (so the access token can't be replayed before it expires) and deletes the
   * Session rows so a re-login is forced. Reused by the role-change path and by
   * the control-plane per-tenant user suspend. Returns the number of sessions
   * that were invalidated. Best-effort: a malformed token never aborts the loop.
   */
  private async revokeUserSessions(userId: string): Promise<number> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      select: { id: true, token: true },
    });

    for (const session of sessions) {
      try {
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

    await this.prisma.session.deleteMany({ where: { userId } });
    return sessions.length;
  }

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
    const invalidated = await this.revokeUserSessions(userId);

    this.logger.log(`Role updated for user ${user.email}: ${newRole} — ${invalidated} session(s) invalidated`);

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
    const startMs = Date.now();
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
      services.push({ name: 'PostgreSQL', status: 'healthy', latencyMs: Date.now() - dbStart, lastCheckedAt: now });
    } catch (err: any) {
      services.push({ name: 'PostgreSQL', status: 'down', latencyMs: Date.now() - dbStart, lastCheckedAt: now, errorMessage: err?.message });
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

    const hasUnhealthy = services.some(s => s.status === 'down');
    const hasDegraded = services.some(s => s.status === 'degraded');
    const overallStatus = hasUnhealthy ? 'degraded' : hasDegraded ? 'degraded' : 'healthy';

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

    return { overallStatus, services, clusterNodes, checkedAt: now, uptime: uptimeSec, timestamp: now, totalMs: Date.now() - startMs };
  }

  // ─── Platform Overview ──────────────────────────────────────────────────

  @Get('overview')
  async overview() {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      userCount,
      sessionCount,
      newUsersThisWeek,
      tenantCount,
      activeTenantCount,
      suspendedTenantCount,
      trialingTenantCount,
      newTenantsThisWeek,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.session.count(),
      this.prisma.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.tenant.count({ where: { subscriptionStatus: 'TRIALING' } }),
      this.prisma.tenant.count({ where: { createdAt: { gte: oneWeekAgo } } }),
    ]);

    const uptimeSeconds = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);

    return {
      tenantCount,
      activeTenantCount,
      suspendedTenantCount,
      trialingTenantCount,
      totalUserCount: userCount,
      activeSessionCount: sessionCount,
      storageUsageBytes: 0,
      apiCallsToday: 0,
      apiCallsThisMonth: 0,
      newTenantsThisWeek,
      newUsersThisWeek,
      uptime: uptimeSeconds,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Tenant Management ──────────────────────────────────────────────────

  @Get('tenants')
  async listTenants(@Query() query: any) {
    const page = Math.max(1, query.page ? parseInt(query.page, 10) : 1);
    const limit = Math.min(100, Math.max(1, query.limit ? parseInt(query.limit, 10) : 20));

    const where: Record<string, any> = {};
    if (query.status) where.status = query.status;
    if (query.plan) where.plan = query.plan;
    if (query.search) {
      const search = String(query.search);
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const items = await Promise.all(rows.map((t) => this.mapTenantRecord(t)));

    return { items, total, page, limit };
  }

  @Get('tenants/:id')
  async getTenant(@Param('id') id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return this.mapTenantRecord(tenant);
  }

  @Post('tenants/:id/suspend')
  async suspendTenant(@Param('id') id: string, @Body() body: any, @CurrentUser() currentUser: any) {
    const existing = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    this.logger.warn(`Tenant suspended: ${id} — reason: ${body?.reason ?? 'none'}`);
    await this.auditService.log({
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      action: 'suspend',
      resource: 'tenants',
      resourceId: id,
      detail: `Suspended tenant ${tenant.slug} — reason: ${body?.reason ?? 'Administrative action'}`,
    });

    const mapped = await this.mapTenantRecord(tenant);
    return {
      ...mapped,
      status: tenant.status,
      suspendedAt: tenant.updatedAt.toISOString(),
      suspendReason: body?.reason ?? 'Administrative action',
    };
  }

  @Post('tenants/:id/activate')
  async activateTenant(@Param('id') id: string, @CurrentUser() currentUser: any) {
    const existing = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    this.logger.log(`Tenant activated: ${id}`);
    await this.auditService.log({
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      action: 'activate',
      resource: 'tenants',
      resourceId: id,
      detail: `Activated tenant ${tenant.slug}`,
    });

    return this.mapTenantRecord(tenant);
  }

  // ─── Per-tenant monitor + user controls (Phase 5 / W1b) ─────────────────
  // Bemind ops (SuperAdminGuard) monitor and control individual solopreneur
  // tenants: drill into one tenant's users/memberships, usage, subscription
  // and recent activity (MONITOR); change a tenant's plan and suspend / remove
  // a specific user within a tenant (CONTROL). All entitlement/usage numbers
  // are reused from the existing TenantUsageService — no duplicated logic.

  /** Allowed tenant plans (kept in sync with the platform-settings defaults). */
  private static readonly PLANS = ['STARTER', 'GROWTH', 'ENTERPRISE', 'CUSTOM'];

  /**
   * Returns the per-tenant users list with each user's role in THIS tenant
   * (from Membership when present, falling back to the user's global role for
   * legacy rows that pre-date memberships). Used by the monitor detail view and
   * exposed directly so the platform-admin UI can page a single tenant's users.
   */
  @Get('tenants/:id/users')
  async listTenantUsers(@Param('id') tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Memberships are the source of truth for "who belongs to this tenant".
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId },
      select: {
        role: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true, role: true, isSuperAdmin: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const items = memberships.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      // Role WITHIN this tenant (Membership.role), not the global User.role.
      role: m.role,
      isSuperAdmin: m.user.isSuperAdmin,
      memberSince: m.createdAt.toISOString(),
      userCreatedAt: m.user.createdAt.toISOString(),
    }));

    return { tenantId, items, total: items.length };
  }

  /**
   * Full per-tenant monitor view for the control plane: the tenant DTO enriched
   * with subscription/trial status, live usage (apiCallsThisMonth + storage),
   * the tenant's users/memberships, and recent activity from the AuditLog
   * (scoped to this tenant). One Bemind-ops endpoint to see everything about a
   * solopreneur business.
   */
  @Get('tenants/:id/detail')
  async tenantDetail(@Param('id') id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const [mapped, users, recentActivity, apiCallsThisMonth] = await Promise.all([
      this.mapTenantRecord(tenant),
      this.listTenantUsers(id),
      // Recent activity for this tenant from the shared AuditLog (best-effort —
      // an unavailable table must not break the monitor view).
      this.prisma.auditLog
        .findMany({
          where: { tenantId: id },
          orderBy: { timestamp: 'desc' },
          take: 20,
          select: {
            id: true,
            timestamp: true,
            userId: true,
            userEmail: true,
            action: true,
            resource: true,
            resourceId: true,
            detail: true,
            success: true,
          },
        })
        .catch(() => [] as any[]),
      this.tenantUsage.current(tenant.id),
    ]);

    return {
      ...mapped,
      subscription: {
        status: tenant.subscriptionStatus,
        plan: tenant.plan,
        trialEndsAt: tenant.trialEndsAt ? tenant.trialEndsAt.toISOString() : null,
        stripeCustomerId: tenant.stripeCustomerId ?? null,
        stripeSubscriptionId: tenant.stripeSubscriptionId ?? null,
      },
      usage: {
        apiCallsThisMonth,
        storageUsageBytes: mapped.storageUsageBytes,
      },
      users: users.items,
      memberCount: users.total,
      recentActivity: recentActivity.map((a: any) => ({
        ...a,
        timestamp: a.timestamp instanceof Date ? a.timestamp.toISOString() : a.timestamp,
      })),
    };
  }

  /**
   * CONTROL: change a tenant's plan. Validates against the allowed plan set,
   * persists Tenant.plan, and audit-logs the change. Entitlement effects flow
   * from the plan field — this endpoint does not duplicate that mapping.
   */
  @Patch('tenants/:id/plan')
  async updateTenantPlan(@Param('id') id: string, @Body() body: any, @CurrentUser() currentUser: any) {
    const newPlan = String(body?.plan ?? '').toUpperCase();
    if (!AdminController.PLANS.includes(newPlan)) {
      throw new BadRequestException(`Invalid plan. Must be one of: ${AdminController.PLANS.join(', ')}`);
    }

    const existing = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true, plan: true } });
    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { plan: newPlan },
    });

    this.logger.log(`Tenant plan changed: ${id} — ${existing.plan} → ${newPlan}`);
    await this.auditService.log({
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      action: 'update',
      resource: 'tenants',
      resourceId: id,
      detail: `Changed plan ${existing.plan} → ${newPlan} for tenant ${tenant.slug}`,
    });

    return this.mapTenantRecord(tenant);
  }

  /**
   * Resolves a (tenant, user) pair to the user and their membership, or throws
   * NotFound. Guards every per-tenant user control so a Bemind op can only act
   * on a user who actually belongs to the target tenant.
   */
  private async getTenantMember(tenantId: string, userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, slug: true } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { id: true, role: true, user: { select: { id: true, email: true, isSuperAdmin: true } } },
    });
    if (!membership) {
      throw new NotFoundException('User is not a member of this tenant');
    }
    return { tenant, membership };
  }

  /**
   * CONTROL: suspend a specific user within a tenant. Bemind ops never touch a
   * fellow super-admin this way. Suspension PERSISTS the membership status
   * (Membership.status = SUSPENDED) so re-login can't restore access, and ALSO
   * revokes every active session (blacklisting the JWT jti so the access token
   * can't be replayed). Suspension scopes to THIS tenant only — the user's
   * other businesses are unaffected. Enforced at switch + jwt.strategy.
   */
  @Post('tenants/:id/users/:userId/suspend')
  async suspendTenantUser(
    @Param('id') tenantId: string,
    @Param('userId') userId: string,
    @Body() body: any,
    @CurrentUser() currentUser: any,
  ) {
    const { tenant, membership } = await this.getTenantMember(tenantId, userId);
    if (membership.user.isSuperAdmin) {
      throw new BadRequestException('Cannot suspend a platform super-admin');
    }

    // Persist the suspended state so it survives re-login (session revocation
    // alone is not enough — a fresh token would otherwise restore access).
    await this.prisma.membership.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: { status: 'SUSPENDED' },
    });

    const invalidated = await this.revokeUserSessions(userId);

    this.logger.warn(`User suspended in tenant ${tenant.slug}: ${membership.user.email} — ${invalidated} session(s) revoked`);
    await this.auditService.log({
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      action: 'suspend',
      resource: 'users',
      resourceId: userId,
      detail: `Suspended user ${membership.user.email} in tenant ${tenant.slug} — reason: ${body?.reason ?? 'Administrative action'}`,
    });

    return {
      tenantId,
      userId,
      email: membership.user.email,
      status: 'SUSPENDED',
      sessionsRevoked: invalidated,
      suspendReason: body?.reason ?? 'Administrative action',
    };
  }

  /**
   * CONTROL: re-activate a previously-suspended user within a tenant. Clears the
   * persisted Membership.status back to ACTIVE; the user regains access to this
   * tenant by logging in again (or switching into it).
   */
  @Post('tenants/:id/users/:userId/activate')
  async activateTenantUser(
    @Param('id') tenantId: string,
    @Param('userId') userId: string,
    @CurrentUser() currentUser: any,
  ) {
    const { tenant, membership } = await this.getTenantMember(tenantId, userId);

    await this.prisma.membership.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: { status: 'ACTIVE' },
    });

    this.logger.log(`User reactivated in tenant ${tenant.slug}: ${membership.user.email}`);
    await this.auditService.log({
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      action: 'activate',
      resource: 'users',
      resourceId: userId,
      detail: `Reactivated user ${membership.user.email} in tenant ${tenant.slug}`,
    });

    return { tenantId, userId, email: membership.user.email, status: 'ACTIVE' };
  }

  /**
   * CONTROL: remove a user from a tenant by deleting their Membership (their
   * access to OTHER tenants is untouched). Refuses to remove the tenant's last
   * OWNER membership so a solopreneur business can't be orphaned, and revokes
   * the removed user's sessions. The User row itself is not deleted.
   */
  @Delete('tenants/:id/users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTenantUser(
    @Param('id') tenantId: string,
    @Param('userId') userId: string,
    @CurrentUser() currentUser: any,
  ) {
    const { tenant, membership } = await this.getTenantMember(tenantId, userId);

    // Don't orphan a business: refuse to remove the last OWNER membership.
    if (membership.role === 'OWNER') {
      const ownerCount = await this.prisma.membership.count({ where: { tenantId, role: 'OWNER' } });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner of a tenant');
      }
    }

    await this.prisma.membership.delete({
      where: { userId_tenantId: { userId, tenantId } },
    });

    // If the removed tenant was the user's active context, clear it so the next
    // request re-resolves a tenant they still belong to.
    await this.prisma.user.updateMany({
      where: { id: userId, activeTenantId: tenantId },
      data: { activeTenantId: null },
    });

    await this.revokeUserSessions(userId);

    this.logger.warn(`User ${membership.user.email} removed from tenant ${tenant.slug} by ${currentUser?.email}`);
    await this.auditService.log({
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      action: 'delete',
      resource: 'memberships',
      resourceId: membership.id,
      detail: `Removed user ${membership.user.email} from tenant ${tenant.slug}`,
    });
  }

  // ─── Platform Settings ──────────────────────────────────────────────────

  @Get('settings')
  async getSettings() {
    return this.getPlatformSettings();
  }

  @Patch('settings')
  async updateSettings(@Body() body: any, @CurrentUser() currentUser: any) {
    // Load current persisted state
    let stored: Record<string, any> = {};
    try {
      const row = await this.prisma.settings.findUnique({ where: { id: 'platform-admin' } });
      if (row?.data && typeof row.data === 'object') {
        stored = row.data as Record<string, any>;
      }
    } catch {
      // Fresh install — stored stays empty
    }

    // Apply mutable fields (featureToggles are read-only from the license and
    // are intentionally excluded here — they cannot be overridden via this endpoint)
    if (body.defaultPlan !== undefined) stored.defaultPlan = body.defaultPlan;
    if (body.allowedPlans !== undefined) stored.allowedPlans = body.allowedPlans;
    if (body.defaultUserQuota !== undefined) stored.defaultUserQuota = body.defaultUserQuota;
    if (body.defaultStorageQuotaBytes !== undefined) stored.defaultStorageQuotaBytes = body.defaultStorageQuotaBytes;
    if (body.defaultApiCallQuotaPerDay !== undefined) stored.defaultApiCallQuotaPerDay = body.defaultApiCallQuotaPerDay;
    if (body.maintenanceMode !== undefined) stored.maintenanceMode = body.maintenanceMode;
    if (body.registrationEnabled !== undefined) stored.registrationEnabled = body.registrationEnabled;
    stored.updatedAt = new Date().toISOString();
    stored.updatedBy = currentUser?.email ?? 'system';

    // Persist to Settings table so changes survive restarts
    try {
      await this.prisma.settings.upsert({
        where: { id: 'platform-admin' },
        update: { data: stored },
        create: { id: 'platform-admin', data: stored },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to persist platform settings: ${err?.message}`);
    }

    this.logger.log(`Platform settings updated by ${stored.updatedBy}`);
    return this.getPlatformSettings();
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
