import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '@unicore/shared-types';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  roles: (UserRole | '*')[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}
