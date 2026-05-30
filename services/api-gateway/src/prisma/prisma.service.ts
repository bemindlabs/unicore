import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
 * TenantContextInterceptor. Self-host is a no-op pass-through (always the
 * default tenant).
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
  constructor() {
    super();
    return this.$extends(tenantRlsExtension) as unknown as PrismaService;
  }

  async onModuleInit() {
    await this.$connect();
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
