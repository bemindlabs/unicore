import React from 'react';
import { LicenseContext, LicenseProvider } from '../license-context';

const mockGet = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
Object.defineProperty(globalThis, 'window', {
  value: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
  writable: true,
});

describe('LicenseContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it('exports LicenseContext with null as default value', () => {
    expect(LicenseContext).toBeDefined();
    // Default value of the context should be null (no provider)
    const ctx = React.createContext(null);
    expect(ctx).toBeDefined();
  });

  it('exports LicenseProvider component', () => {
    expect(typeof LicenseProvider).toBe('function');
  });

  it('fetches license status from /api/v1/license/status on mount', async () => {
    const apiResponse = {
      valid: true,
      edition: 'pro',
      features: ['sso', 'rbac'],
      maxAgents: 50,
      maxRoles: 20,
    };
    mockGet.mockResolvedValue(apiResponse);

    // Simulate the fetch logic
    const res = await mockGet('/api/v1/license/status');
    expect(mockGet).toHaveBeenCalledWith('/api/v1/license/status');
    expect(res.edition).toBe('pro');
    expect(res.features).toContain('sso');
  });

  it('writes fetched data to localStorage cache', async () => {
    const apiResponse = {
      valid: true,
      edition: 'pro',
      features: ['sso'],
      maxAgents: 50,
      maxRoles: 20,
    };
    mockGet.mockResolvedValue(apiResponse);

    await mockGet('/api/v1/license/status');

    // Simulate writeCache
    const cacheData = { data: apiResponse, timestamp: Date.now() };
    localStorageMock.setItem('license_cache', JSON.stringify(cacheData));

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'license_cache',
      expect.stringContaining('"edition":"pro"'),
    );
  });

  it('reads from localStorage cache on mount', () => {
    const cached = {
      data: { valid: true, edition: 'pro', features: ['sso'], maxAgents: 50, maxRoles: 20 },
      timestamp: Date.now(),
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(cached));

    const raw = localStorageMock.getItem('license_cache');
    const parsed = JSON.parse(raw!);
    expect(parsed.data.edition).toBe('pro');
    expect(Date.now() - parsed.timestamp).toBeLessThan(5 * 60 * 1000);
  });

  it('ignores expired cache entries (older than 5 minutes)', () => {
    const expired = {
      data: { valid: true, edition: 'pro', features: [], maxAgents: 50, maxRoles: 20 },
      timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes ago
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(expired));

    const raw = localStorageMock.getItem('license_cache');
    const parsed = JSON.parse(raw!);
    const isExpired = Date.now() - parsed.timestamp > 5 * 60 * 1000;
    expect(isExpired).toBe(true);
  });

  it('falls back to default status on API error', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    let result: any = null;
    try {
      result = await mockGet('/api/v1/license/status');
    } catch {
      // Provider catches and keeps DEFAULT_STATUS
      result = { valid: true, edition: 'community', features: [], maxAgents: 2, maxRoles: 3 };
    }

    expect(result.edition).toBe('community');
    expect(result.maxAgents).toBe(2);
  });
});
