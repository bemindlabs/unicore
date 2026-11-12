import { DEMO_TENANT_ID, isSaaS } from './tenancy.config';

describe('tenancy.config', () => {
  it('is always SaaS — there is no self-host mode', () => {
    expect(isSaaS()).toBe(true);
  });

  it('exposes the all-zero demo/bootstrap tenant id', () => {
    expect(DEMO_TENANT_ID).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('ignores DEPLOYMENT_MODE — always SaaS', () => {
    const original = process.env.DEPLOYMENT_MODE;
    process.env.DEPLOYMENT_MODE = 'self-host';
    expect(isSaaS()).toBe(true);
    process.env.DEPLOYMENT_MODE = original;
  });
});
