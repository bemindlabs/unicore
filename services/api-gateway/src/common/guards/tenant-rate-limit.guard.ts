import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RateLimitStore } from '../middleware/rate-limit.store';
import { TenantUsageService } from '../tenancy/tenant-usage.service';
import { DEMO_TENANT_ID } from '../tenancy/tenancy.config';
import { rateLimitForPlan, monthlyApiCapForPlan } from '../tenancy/plans.config';

/**
 * Per-tenant noisy-neighbor protection (FU-04).
 *
 * Two layers, both keyed by the resolved tenant id (from the JWT `tid` claim,
 * attached to `req.user.tenantId` by jwt.strategy):
 *
 *  1. Burst rate limit — a per-tenant sliding window (reusing {@link RateLimitStore})
 *     sized from the tenant's plan (`rateLimitForPlan`). Protects shared
 *     Postgres/Redis/Qdrant from a single tenant flooding the gateway.
 *  2. Monthly usage cap — increments the per-tenant monthly counter
 *     ({@link TenantUsageService}) and rejects with 429 once the plan's
 *     `monthlyApiCapForPlan` is exceeded.
 *
 * The local/demo bootstrap tenant and internal service calls (`x-internal-service`)
 * are exempt from metering.
 *
 * Runs as a global guard after JwtAuthGuard so the resolved tenant is present.
 * Read-only/health/auth paths are not exempted from rate limiting (a flood of
 * GETs is still noisy) but the cap only counts here, not at the IP layer.
 */
@Injectable()
export class TenantRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(TenantRateLimitGuard.name);
  private readonly windowMs = parseInt(
    process.env.TENANT_RATE_LIMIT_WINDOW_MS ?? '60000',
    10,
  );

  /** Short cache of tenant → plan so we don't hit the DB on every request. */
  private readonly planCache = new Map<string, { plan: string; at: number }>();
  private static readonly PLAN_TTL_MS = 30_000;

  constructor(
    private readonly store: RateLimitStore,
    private readonly usage: TenantUsageService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Internal service-to-service calls carry their own trust header.
    if (req.headers?.['x-internal-service']) return true;

    const user = req.user as { tenantId?: string } | undefined;
    const tenantId = user?.tenantId;
    // No resolved tenant or the local/demo tenant → nothing to meter.
    if (!tenantId || tenantId === DEMO_TENANT_ID) return true;

    const plan = await this.resolvePlan(tenantId);

    // 1. Per-tenant burst rate limit.
    const perMinute = rateLimitForPlan(plan);
    const burst = this.store.increment(`tenant-rl:${tenantId}`, this.windowMs);
    if (burst.count > perMinute) {
      const retryAfter = Math.ceil(burst.resetInMs / 1000);
      this.logger.warn(
        `Tenant rate limit exceeded: ${tenantId} (${burst.count}/${perMinute} per ${this.windowMs}ms)`,
      );
      this.throw429(
        'Tenant request rate limit exceeded. Please slow down and retry.',
        { tenantId, limit: perMinute, scope: 'rate', retryAfterSeconds: retryAfter },
        retryAfter,
      );
    }

    // 2. Monthly usage cap.
    const cap = monthlyApiCapForPlan(plan);
    const used = await this.usage.increment(tenantId);
    if (used > cap) {
      this.logger.warn(
        `Tenant monthly API cap exceeded: ${tenantId} (${used}/${cap}, plan=${plan})`,
      );
      this.throw429(
        'Monthly API usage cap reached for your plan. Upgrade to increase your limit.',
        { tenantId, plan, limit: cap, used, scope: 'monthly-quota' },
      );
    }

    return true;
  }

  private throw429(
    message: string,
    extra: Record<string, unknown>,
    retryAfterSeconds?: number,
  ): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message,
        ...extra,
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async resolvePlan(tenantId: string): Promise<string> {
    const cached = this.planCache.get(tenantId);
    if (cached && Date.now() - cached.at < TenantRateLimitGuard.PLAN_TTL_MS) {
      return cached.plan;
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    const plan = tenant?.plan ?? 'STARTER';
    this.planCache.set(tenantId, { plan, at: Date.now() });
    return plan;
  }
}
