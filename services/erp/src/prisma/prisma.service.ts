import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '../generated/prisma';
import { getTenantId } from '../common/tenancy/tenant-context';

/**
 * Recursion guard. Set while we are inside our own tenant-scoping transaction
 * so the re-dispatched operation on `tx` does NOT open another transaction.
 */
const scoped = new AsyncLocalStorage<true>();

/**
 * NestJS wrapper around PrismaClient with tenant-aware Row-Level Security
 * (SaaS phase 4.5).
 *
 * Every query is wrapped in a transaction that first issues
 * `SET LOCAL app.tenant_id = '<tenant>'`, so the Postgres RLS policies
 * (`scripts/apply-rls.sql`) restrict every read/write to the current request's
 * tenant. The tenant id is read from the request-scoped AsyncLocalStorage
 * populated by {@link TenantContextMiddleware}.
 *
 * Self-host is a no-op pass-through: the tenant id is always the default
 * tenant, RLS matches every row, and behavior is identical to the
 * pre-tenancy build.
 *
 * The client is generated into src/generated/prisma by running:
 *   pnpm prisma:generate
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    return this.$extends(tenantRlsExtension) as unknown as PrismaService;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected to PostgreSQL (tenant-RLS enabled)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from PostgreSQL');
  }
}

/**
 * Quote a tenant id for safe inline interpolation. The value always originates
 * from {@link getTenantId}, which only ever returns a validated UUID or the
 * default constant, but we re-validate and quote defensively.
 */
function quoteTenantId(tenantId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
    throw new Error(`Refusing to set invalid tenant id: ${tenantId}`);
  }
  return `'${tenantId}'`;
}

/**
 * Prisma client extension that scopes every model operation to the current
 * tenant by running it inside an interactive transaction prefixed with
 * `SET LOCAL app.tenant_id`, then re-dispatching the operation on the
 * transaction client (`tx`) so the query and the SET LOCAL share one
 * connection. RLS policies on the base tables then enforce isolation;
 * `SET LOCAL` is transaction-scoped, so pooled connections never leak the
 * setting across requests.
 *
 * If the operation is already inside a transaction (`tx` set), we don't nest —
 * the enclosing tenant transaction already pinned the var.
 */
const tenantRlsExtension = Prisma.defineExtension((client) =>
  client.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        // Non-model ops, or the re-dispatched op already inside our tenant
        // transaction, run as-is (the enclosing scope set app.tenant_id).
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

/** Map a Prisma model name (`InvoiceLine`) to its client delegate key (`invoiceLine`). */
function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
