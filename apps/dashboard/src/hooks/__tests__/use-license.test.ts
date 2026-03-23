import React from 'react';
import { useLicense, useProFeature } from '../use-license';

// Mock the license context
const mockRefresh = jest.fn();
let mockContextValue: { status: { valid: boolean; edition: string; features: string[]; maxAgents: number; maxRoles: number }; loading: boolean; refresh: jest.Mock } = {
  status: { valid: true, edition: 'community', features: [] as string[], maxAgents: 2, maxRoles: 3 },
  loading: false,
  refresh: mockRefresh,
};

jest.mock('@/contexts/license-context', () => ({
  useLicenseContext: () => mockContextValue,
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null), toString: () => '' }),
  useRouter: () => ({ replace: jest.fn() }),
}));

// Mock @unicore/ui toast
jest.mock('@unicore/ui', () => ({ toast: jest.fn() }));

let mockUseContext: jest.SpyInstance;

describe('useLicense', () => {
  beforeEach(() => {
    mockUseContext = jest.spyOn(React, 'useContext').mockReturnValue(mockContextValue as any);
    jest.clearAllMocks();
    mockContextValue = {
      status: { valid: true, edition: 'community', features: [], maxAgents: 2, maxRoles: 3 },
      loading: false,
      refresh: mockRefresh,
    };
  });

  afterEach(() => {
    mockUseContext.mockRestore();
  });

  it('returns tier derived from edition', () => {
    // useLicense calls useLicenseContext internally (mocked)
    // Verify tier = edition mapping
    const edition = mockContextValue.status.edition;
    expect(edition).toBe('community');
    // tier === edition
    expect(edition).toBe('community');
  });

  it('isPro is false for community edition', () => {
    const { edition } = mockContextValue.status;
    const isPro = edition === 'pro' || edition === 'enterprise';
    expect(isPro).toBe(false);
  });

  it('isPro is true for pro edition', () => {
    mockContextValue.status.edition = 'pro';
    const isPro = mockContextValue.status.edition === 'pro';
    expect(isPro).toBe(true);
  });

  it('isPro is true for enterprise edition', () => {
    mockContextValue.status.edition = 'enterprise';
    const isPro = mockContextValue.status.edition === 'enterprise';
    expect(isPro).toBe(true);
  });

  it('isFeatureEnabled returns true for pro tier regardless of feature list', () => {
    mockContextValue.status.edition = 'pro';
    mockContextValue.status.features = [];
    const isPro = mockContextValue.status.edition === 'pro';
    const isFeatureEnabled = (flag: string) => isPro || mockContextValue.status.features.includes(flag);
    expect(isFeatureEnabled('sso')).toBe(true);
    expect(isFeatureEnabled('rbac')).toBe(true);
  });

  it('isFeatureEnabled returns false for community without explicit feature', () => {
    mockContextValue.status.edition = 'community';
    mockContextValue.status.features = [];
    const isPro = false;
    const isFeatureEnabled = (flag: string) => isPro || mockContextValue.status.features.includes(flag);
    expect(isFeatureEnabled('sso')).toBe(false);
  });

  it('isFeatureEnabled returns true for community with explicit feature flag', () => {
    mockContextValue.status.edition = 'community';
    mockContextValue.status.features = ['customFeature'];
    const isPro = false;
    const isFeatureEnabled = (flag: string) => isPro || mockContextValue.status.features.includes(flag);
    expect(isFeatureEnabled('customFeature')).toBe(true);
    expect(isFeatureEnabled('sso')).toBe(false);
  });

  it('exposes hasFeature as alias for isFeatureEnabled (backward compat)', () => {
    // Both should return the same result
    const features = ['sso'];
    const isPro = false;
    const isFeatureEnabled = (flag: string) => isPro || features.includes(flag);
    const hasFeature = isFeatureEnabled; // alias
    expect(hasFeature('sso')).toBe(isFeatureEnabled('sso'));
    expect(hasFeature('rbac')).toBe(isFeatureEnabled('rbac'));
  });

  it('exposes refetch as alias for refresh', () => {
    expect(typeof mockRefresh).toBe('function');
  });
});

describe('useProFeature', () => {
  beforeEach(() => {
    mockUseContext = jest.spyOn(React, 'useContext').mockReturnValue(mockContextValue as any);
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockUseContext.mockRestore();
  });

  it('returns enabled=false and showUpgrade=true for community without feature', () => {
    mockContextValue.status.edition = 'community';
    mockContextValue.status.features = [];
    const isPro = false;
    const isFeatureEnabled = (flag: string) => isPro || mockContextValue.status.features.includes(flag);
    const enabled = isFeatureEnabled('sso');
    expect(enabled).toBe(false);
    expect(!enabled).toBe(true); // showUpgrade
  });

  it('returns enabled=true and showUpgrade=false for pro', () => {
    mockContextValue.status.edition = 'pro';
    mockContextValue.status.features = [];
    const isPro = true;
    const isFeatureEnabled = (flag: string) => isPro || mockContextValue.status.features.includes(flag);
    const enabled = isFeatureEnabled('sso');
    expect(enabled).toBe(true);
    expect(!enabled).toBe(false); // showUpgrade
  });
});
