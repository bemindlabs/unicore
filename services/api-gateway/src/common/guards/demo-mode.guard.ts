import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject, Optional } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

/** Paths that always pass through (auth, health, webhooks, license activation) */
const PUBLIC_PATHS = ['/auth/', '/health', '/webhooks/', '/demo-status', '/api/v1/license/activate', '/api/v1/license/status', '/api/v1/license/revalidate'];

/** Paths always blocked in demo mode (no user check — public endpoints like wizard) */
const ALWAYS_BLOCKED_PATHS = [
  '/api/v1/bootstrap',
  '/api/proxy/bootstrap',
];

/** Paths blocked in demo mode for non-OWNER (both read and write) */
const RESTRICTED_PATHS = [
  '/api/v1/settings',
  '/api/v1/admin/users',
];

@Injectable()
export class DemoModeGuard implements CanActivate {
  private readonly isDemoMode: boolean;

  constructor(@Optional() @Inject(AuditService) private readonly auditService?: AuditService) {
    this.isDemoMode = process.env.DEMO_MODE === 'true';
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.isDemoMode) return true;

    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();
    const path = (request.path ?? request.url ?? '') as string;

    // Public endpoints always pass (login, register, webhooks, health, demo-status)
    if (PUBLIC_PATHS.some((p) => path.includes(p))) return true;

    // Internal service requests always pass (ai-engine, rag, etc.)
    const internalService = request.headers?.['x-internal-service'];
    if (internalService) return true;

    // Always blocked in demo mode (wizard/bootstrap — no exceptions)
    if (ALWAYS_BLOCKED_PATHS.some((p) => path.includes(p))) {
      throw new ForbiddenException('This action is not available in demo mode');
    }

    // OWNER bypasses all remaining restrictions
    const user = request.user;
    if (user?.role === 'OWNER') return true;

    // Check if path is restricted (blocked for both read and write)
    const isRestricted = RESTRICTED_PATHS.some((p) => path.includes(p));
    if (isRestricted) {
      this.logBlocked(user, method, path);
      throw new ForbiddenException('This action is not available in demo mode');
    }

    // Non-restricted read operations pass through
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

    // All other write operations blocked for non-OWNER
    this.logBlocked(user, method, path);
    throw new ForbiddenException('This action is not available in demo mode');
  }

  private logBlocked(user: any, method: string, path: string): void {
    this.auditService?.log({
      userId: user?.id,
      userEmail: user?.email,
      action: 'demo_blocked',
      resource: path,
      detail: `Demo mode blocked ${method} ${path} by ${user?.email ?? 'anonymous'}`,
      success: false,
    }).catch(() => {});
  }
}
