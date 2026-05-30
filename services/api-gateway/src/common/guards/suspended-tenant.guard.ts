import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isSaaS, DEFAULT_TENANT_ID } from '../tenancy/tenancy.config';

/**
 * Read-only safe methods — always allowed even when a tenant is suspended.
 */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Path fragments that must stay writable for a suspended tenant so they can
 * recover: auth (login/logout/refresh), health, webhooks, billing/conversion,
 * and license activation. Mirrors the DemoModeGuard allow-list shape.
 */
const ALLOW_WHEN_SUSPENDED = [
  '/auth/',
  '/health',
  '/webhooks/',
  '/api/v1/tenant/subscription',
  '/api/v1/billing',
  '/api/v1/license/activate',
];

interface CacheEntry {
  suspended: boolean;
  at: number;
}

/** Short cache so we don't query tenant status on every write. */
const CACHE_TTL_MS = 15_000;

/**
 * Enforces read-only access for SUSPENDED tenants (M3/E3), saas mode only.
 *
 * When a tenant's trial expires the scheduler flips it to status SUSPENDED.
 * This guard then rejects mutating requests (POST/PATCH/PUT/DELETE) with 403
 * while still permitting reads and the recovery/billing paths. Self-host is an
 * unconditional pass-through (no suspension concept). Reuses the existing
 * admin suspend semantics (tenant.status === 'SUSPENDED').
 */
@Injectable()
export class SuspendedTenantGuard implements CanActivate {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!isSaaS()) return true;

    const req = context.switchToHttp().getRequest();
    const method = (req.method || '').toUpperCase();

    if (READ_METHODS.has(method)) return true;

    const path = (req.path ?? req.url ?? '') as string;
    if (ALLOW_WHEN_SUSPENDED.some((p) => path.includes(p))) return true;

    // Internal service calls (ai-engine, rag, etc.) carry their own trust header.
    if (req.headers?.['x-internal-service']) return true;

    const user = req.user as { tenantId?: string } | undefined;
    const tenantId = user?.tenantId;
    // No resolved tenant or the default tenant → nothing to suspend.
    if (!tenantId || tenantId === DEFAULT_TENANT_ID) return true;

    if (await this.isSuspended(tenantId)) {
      throw new ForbiddenException(
        'Your trial has ended and the workspace is read-only. Upgrade to restore full access.',
      );
    }
    return true;
  }

  private async isSuspended(tenantId: string): Promise<boolean> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.suspended;
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });
    const suspended = tenant?.status === 'SUSPENDED';
    this.cache.set(tenantId, { suspended, at: Date.now() });
    return suspended;
  }
}
