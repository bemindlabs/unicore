import {
  DEFAULT_TENANT_ID,
  getDeploymentMode,
  isSaaS,
  isSelfHost,
  getDefaultTenantId,
  resolveTenantId,
} from './tenancy.config';

describe('tenancy.config', () => {
  const original = {
    DEPLOYMENT_MODE: process.env.DEPLOYMENT_MODE,
    ENABLE_MULTI_TENANT: process.env.ENABLE_MULTI_TENANT,
  };

  afterEach(() => {
    process.env.DEPLOYMENT_MODE = original.DEPLOYMENT_MODE;
    process.env.ENABLE_MULTI_TENANT = original.ENABLE_MULTI_TENANT;
  });

  function clearEnv() {
    delete process.env.DEPLOYMENT_MODE;
    delete process.env.ENABLE_MULTI_TENANT;
  }

  it('defaults to self-host when nothing is set', () => {
    clearEnv();
    expect(getDeploymentMode()).toBe('self-host');
    expect(isSelfHost()).toBe(true);
    expect(isSaaS()).toBe(false);
  });

  it('honors DEPLOYMENT_MODE=saas', () => {
    clearEnv();
    process.env.DEPLOYMENT_MODE = 'saas';
    expect(getDeploymentMode()).toBe('saas');
    expect(isSaaS()).toBe(true);
  });

  it('honors the legacy ENABLE_MULTI_TENANT=true alias', () => {
    clearEnv();
    process.env.ENABLE_MULTI_TENANT = 'true';
    expect(getDeploymentMode()).toBe('saas');
  });

  it('exposes the all-zero default tenant id', () => {
    expect(DEFAULT_TENANT_ID).toBe('00000000-0000-0000-0000-000000000000');
    expect(getDefaultTenantId()).toBe(DEFAULT_TENANT_ID);
  });

  describe('resolveTenantId', () => {
    it('always returns the default tenant in self-host mode', () => {
      clearEnv();
      expect(resolveTenantId('some-tenant')).toBe(DEFAULT_TENANT_ID);
      expect(resolveTenantId(null)).toBe(DEFAULT_TENANT_ID);
      expect(resolveTenantId(undefined)).toBe(DEFAULT_TENANT_ID);
    });

    it('returns the resolved tenant in saas mode, falling back to default', () => {
      clearEnv();
      process.env.DEPLOYMENT_MODE = 'saas';
      expect(resolveTenantId('tenant-xyz')).toBe('tenant-xyz');
      expect(resolveTenantId(null)).toBe(DEFAULT_TENANT_ID);
    });
  });
});
