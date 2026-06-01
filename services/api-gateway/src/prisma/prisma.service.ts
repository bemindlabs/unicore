import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '../generated/prisma';
import { getTenantId } from '../common/tenancy/tenant-store';

/**
 * Recursion guard — set while inside our own tenant-scoping transaction so the
 * re-dispatched operation on `tx` does not open another transaction.
 */
const scoped = new AsyncLocalStorage<true>();

/**
 * NestJS wrapper around PrismaClient with tenant-aware Row-Level Security
 * (SaaS phase 4.5). Every model operation runs inside a transaction prefixed
 * with `SET LOCAL app.tenant_id`, so the Postgres RLS policies
 * (`scripts/apply-rls.sql`) restrict reads/writes to the current request's
 * tenant. The tenant id comes from the request-scoped store seeded by
 * TenantContextInterceptor; bootstrap/unauthenticated paths fall back to the
 * local/demo tenant.
 *
 * NOTE: the database role used by DATABASE_URL must be NOSUPERUSER /
 * NOBYPASSRLS, otherwise Postgres bypasses every policy. See
 * scripts/apply-rls.sql.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    return this.$extends(tenantRlsExtension) as unknown as PrismaService;
  }

  async onModuleInit() {
    await this.$connect();
    await this.assertNotRlsBypassingRole();
  }

  /**
   * GAPS #4: the connection role MUST be NOSUPERUSER / NOBYPASSRLS, otherwise
   * Postgres silently ignores every RLS policy (apply-rls.sql) and tenant
   * isolation becomes a no-op. We verify the LIVE role on startup:
   *
   *   - superuser OR bypassrls  → always log a LOUD warning;
   *   - in production (NODE_ENV==='production') OR when REQUIRE_RLS=true,
   *     also REFUSE TO START (throw) so a misconfigured deploy fails closed
   *     instead of silently leaking cross-tenant data;
   *   - in local dev the default is a warning only, so the local superuser
   *     stack keeps working.
   *
   * The query runs on the raw client (not the tenant-scoping extension), so it
   * is not wrapped in a SET LOCAL transaction.
   */
  private async assertNotRlsBypassingRole(): Promise<void> {
    try {
      const rows = await this.$queryRawUnsafe<
        Array<{ rolsuper: boolean; rolbypassrls: boolean }>
      >(
        `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
      );
      const role = rows[0];
      if (!role) {
        this.logger.warn(
          'Could not resolve the current DB role from pg_roles; cannot verify NOSUPERUSER/NOBYPASSRLS. RLS may be bypassed.',
        );
        return;
      }

      if (role.rolsuper || role.rolbypassrls) {
        const which = role.rolsuper ? 'SUPERUSER' : 'BYPASSRLS';
        const msg =
          `The DB connection role is ${which} — Postgres BYPASSES every ` +
          `Row-Level Security policy, so tenant isolation is SILENTLY DISABLED. ` +
          `Point DATABASE_URL at a NOSUPERUSER NOBYPASSRLS role (see scripts/apply-rls.sql).`;

        const requireRls =
          process.env.NODE_ENV === 'production' ||
          process.env.REQUIRE_RLS === 'true';

        if (requireRls) {
          this.logger.error(`!!! REFUSING TO START — ${msg}`);
          throw new Error(`RLS enforcement: ${msg}`);
        }
        this.logger.warn(`!!! RLS WARNING — ${msg}`);
      }
    } catch (err) {
      // A genuine RLS-enforcement throw must propagate and abort startup.
      if (err instanceof Error && err.message.startsWith('RLS enforcement:')) {
        throw err;
      }
      // Any other failure (e.g. pg_roles unreadable) is non-fatal: warn only.
      this.logger.warn(
        `Could not verify DB role privileges for RLS: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

function quoteTenantId(tenantId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
    throw new Error(`Refusing to set invalid tenant id: ${tenantId}`);
  }
  return `'${tenantId}'`;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

const tenantRlsExtension = Prisma.defineExtension((client) =>
  client.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || scoped.getStore()) {
          return query(args);
        }
        const tenantId = getTenantId();
        return (client as unknown as PrismaClient).$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SET LOCAL app.tenant_id = ${quoteTenantId(tenantId)}`,
          );
          const delegate = (
            tx as unknown as Record<string, Record<string, (a: unknown) => unknown>>
          )[lowerFirst(model)];
          return scoped.run(true, () => delegate[operation](args));
        });
      },
    },
  }),
);
