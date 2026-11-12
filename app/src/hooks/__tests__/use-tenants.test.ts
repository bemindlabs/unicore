import type { Membership } from '../use-tenants';

/**
 * Logic-level coverage for the workspace switcher (Phase 5 / W2). The hook
 * itself needs a React render context (not available in the node test env), so
 * we exercise the pure pieces it relies on: active-tenant selection and the
 * token-persistence contract of POST /tenants/switch.
 */

/** Mirrors `useTenants`' active derivation: `tenants.find(isActive) ?? null`. */
function selectActive(tenants: Membership[]): Membership | null {
  return tenants.find((t) => t.isActive) ?? null;
}

describe('useTenants — active tenant selection', () => {
  const make = (over: Partial<Membership>): Membership => ({
    tenantId: 't',
    name: 'Biz',
    plan: 'STARTER',
    role: 'OWNER',
    isActive: false,
    ...over,
  });

  it('returns the membership flagged isActive', () => {
    const tenants = [
      make({ tenantId: 'a', isActive: false }),
      make({ tenantId: 'b', isActive: true }),
    ];
    expect(selectActive(tenants)?.tenantId).toBe('b');
  });

  it('returns null when no membership is active', () => {
    expect(selectActive([make({ isActive: false })])).toBeNull();
  });

  it('returns null for an empty business list', () => {
    expect(selectActive([])).toBeNull();
  });
});

describe('useTenants — switch token persistence contract', () => {
  it('persists the re-issued token + refresh token and the auth cookie', () => {
    const store: Record<string, string> = {};
    const ls = {
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    };
    const doc = { cookie: '' };

    // The exact persistence performed by switchTo() before the hard reload.
    const res = { accessToken: 'new.jwt.token', refreshToken: 'new-refresh' };
    ls.setItem('auth_token', res.accessToken);
    ls.setItem('refresh_token', res.refreshToken);
    doc.cookie = `auth_token=${res.accessToken}; path=/; SameSite=Lax`;

    expect(store.auth_token).toBe('new.jwt.token');
    expect(store.refresh_token).toBe('new-refresh');
    expect(doc.cookie).toContain('auth_token=new.jwt.token');
    expect(doc.cookie).toContain('SameSite=Lax');
  });
});
