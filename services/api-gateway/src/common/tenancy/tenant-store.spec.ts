import { getTenantId, isValidTenantId, runWithTenant } from './tenant-store';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { DEMO_TENANT_ID } from './tenancy.config';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

function ctxWith(req: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('Gateway tenant store', () => {
  it('defaults to the demo/bootstrap tenant outside a request', () => {
    expect(getTenantId()).toBe(DEMO_TENANT_ID);
  });

  it('scopes within runWithTenant and resets after', () => {
    const t = '11111111-1111-1111-1111-111111111111';
    runWithTenant(t, () => expect(getTenantId()).toBe(t));
    expect(getTenantId()).toBe(DEMO_TENANT_ID);
  });

  it('validates uuids', () => {
    expect(isValidTenantId('11111111-1111-1111-1111-111111111111')).toBe(true);
    expect(isValidTenantId('nope')).toBe(false);
  });

  describe('TenantContextInterceptor', () => {
    const interceptor = new TenantContextInterceptor();

    function run(req: unknown): Promise<string> {
      return new Promise((resolve) => {
        const handler: CallHandler = {
          handle: () => {
            resolve(getTenantId());
            return of(null);
          },
        };
        interceptor.intercept(ctxWith(req), handler).subscribe();
      });
    }

    it('seeds the store from req.user.tenantId', async () => {
      const t = '22222222-2222-2222-2222-222222222222';
      expect(await run({ user: { tenantId: t } })).toBe(t);
    });

    it('falls back to req.tenantId then the demo/bootstrap tenant', async () => {
      expect(await run({ tenantId: DEMO_TENANT_ID })).toBe(DEMO_TENANT_ID);
      expect(await run({})).toBe(DEMO_TENANT_ID);
    });
  });
});
