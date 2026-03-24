import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '@bemindlabs/unicore-shared-types';

export interface NavItemLicense {
  /** Required license tier to access this item */
  tier: 'pro' | 'enterprise';
  /** Optional specific feature flag that must be enabled */
  feature?: string;
  /** Human-readable upgrade prompt, defaults to tier name */
  upgradeLabel?: string;
}

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  roles: (UserRole | '*')[];
  /** When set, item requires this license tier/feature to be accessible */
  license?: NavItemLicense;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}
