import { UserRole } from '@unicore/shared-types';
import {
  filterSectionsByRole,
  isNavItemLocked,
  menuSections,
} from '../navigation';
import type { NavItem } from '@/types/navigation';

// ── isNavItemLocked ──────────────────────────────────────────────────────────

describe('isNavItemLocked', () => {
  const communityLicense = { isPro: false, edition: 'community', hasFeature: () => false };
  const proLicense = { isPro: true, edition: 'pro', hasFeature: () => true };
  const enterpriseLicense = { isPro: true, edition: 'enterprise', hasFeature: () => true };

  it('returns false for items with no license requirement', () => {
    const item: NavItem = { label: 'Dashboard', icon: {} as any, href: '/', roles: ['*'] };
    expect(isNavItemLocked(item, communityLicense.isPro, communityLicense.edition, communityLicense.hasFeature)).toBe(false);
    expect(isNavItemLocked(item, proLicense.isPro, proLicense.edition, proLicense.hasFeature)).toBe(false);
  });

  it('returns true for pro items on community edition', () => {
    const item: NavItem = {
      label: 'Audit Logs',
      icon: {} as any,
      href: '/admin/audit-logs',
      roles: [UserRole.Owner],
      license: { tier: 'pro', feature: 'audit' },
    };
    expect(isNavItemLocked(item, false, 'community', () => false)).toBe(true);
  });

  it('returns false for pro items on pro edition', () => {
    const item: NavItem = {
      label: 'Audit Logs',
      icon: {} as any,
      href: '/admin/audit-logs',
      roles: [UserRole.Owner],
      license: { tier: 'pro', feature: 'audit' },
    };
    // hasFeature returns true when isPro
    expect(isNavItemLocked(item, true, 'pro', () => true)).toBe(false);
  });

  it('returns false for pro items when specific feature is explicitly enabled', () => {
    const item: NavItem = {
      label: 'Geek CLI',
      icon: {} as any,
      href: '/geek',
      roles: [UserRole.Owner],
      license: { tier: 'pro', feature: 'featGeekCli' },
    };
    // Community user with explicit featGeekCli add-on
    const hasFeatureWithAddon = (f: string) => f === 'featGeekCli';
    expect(isNavItemLocked(item, false, 'community', hasFeatureWithAddon)).toBe(false);
  });

  it('returns true for enterprise items on pro edition', () => {
    const item: NavItem = {
      label: 'Multi-Tenancy',
      icon: {} as any,
      href: '/platform-admin/tenants',
      roles: [UserRole.Owner],
      license: { tier: 'enterprise' },
    };
    expect(isNavItemLocked(item, true, 'pro', () => true)).toBe(true);
  });

  it('returns false for enterprise items on enterprise edition', () => {
    const item: NavItem = {
      label: 'Multi-Tenancy',
      icon: {} as any,
      href: '/platform-admin/tenants',
      roles: [UserRole.Owner],
      license: { tier: 'enterprise' },
    };
    expect(isNavItemLocked(item, true, 'enterprise', () => true)).toBe(false);
  });

  it('returns true for pro tier items without feature flag when not pro', () => {
    const item: NavItem = {
      label: 'Some Pro Feature',
      icon: {} as any,
      href: '/pro-feature',
      roles: [UserRole.Owner],
      license: { tier: 'pro' },
    };
    expect(isNavItemLocked(item, false, 'community', () => false)).toBe(true);
    expect(isNavItemLocked(item, true, 'pro', () => true)).toBe(false);
  });
});

// ── navigation config ────────────────────────────────────────────────────────

describe('menuSections', () => {
  it('contains always-visible items with no license requirement', () => {
    const alwaysVisible = ['Dashboard', 'AI Agents', 'Tasks Board', 'Knowledge Base', 'AI Chat', 'Settings'];
    const allItems = menuSections.flatMap((s) => s.items);
    for (const label of alwaysVisible) {
      const item = allItems.find((i) => i.label === label);
      expect(item).toBeDefined();
      expect(item?.license).toBeUndefined();
    }
  });

  it('marks Pro features with license tier pro', () => {
    const proItems = ['Agent Builder', 'Workflows', 'All Channels', 'SSO', 'Custom Domains', 'Audit Logs'];
    const allItems = menuSections.flatMap((s) => s.items);
    for (const label of proItems) {
      const item = allItems.find((i) => i.label === label);
      expect(item).toBeDefined();
      expect(item?.license?.tier).toBe('pro');
    }
  });

  it('marks Enterprise section items with license tier enterprise', () => {
    const enterpriseSection = menuSections.find((s) => s.label === 'Enterprise');
    expect(enterpriseSection).toBeDefined();
    for (const item of enterpriseSection!.items) {
      expect(item.license?.tier).toBe('enterprise');
    }
  });

  it('marks add-on items with their feature flags', () => {
    const allItems = menuSections.flatMap((s) => s.items);
    const geekCli = allItems.find((i) => i.label === 'Geek CLI');
    const aiDlc = allItems.find((i) => i.label === 'AI-DLC');
    expect(geekCli?.license?.feature).toBe('featGeekCli');
    expect(aiDlc?.license?.feature).toBe('featAiDlc');
  });
});

// ── filterSectionsByRole ─────────────────────────────────────────────────────

describe('filterSectionsByRole', () => {
  it('returns only sections with items matching the role', () => {
    const sections = filterSectionsByRole(UserRole.Owner);
    expect(sections.length).toBeGreaterThan(0);
    sections.forEach((section) => {
      expect(section.items.length).toBeGreaterThan(0);
      section.items.forEach((item) => {
        expect(item.roles.includes('*') || item.roles.includes(UserRole.Owner)).toBe(true);
      });
    });
  });

  it('filters out owner-only items for non-owner roles', () => {
    const sections = filterSectionsByRole(UserRole.Viewer);
    const allItems = sections.flatMap((s) => s.items);
    // Viewer should only see wildcard items
    allItems.forEach((item) => {
      expect(item.roles.includes('*')).toBe(true);
    });
  });

  it('preserves license metadata on filtered items', () => {
    const sections = filterSectionsByRole(UserRole.Owner);
    const allItems = sections.flatMap((s) => s.items);
    const auditLog = allItems.find((i) => i.label === 'Audit Logs');
    expect(auditLog?.license?.tier).toBe('pro');
    expect(auditLog?.license?.feature).toBe('audit');
  });
});
