import {
  Bot,
  FileText,
  GitBranch,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { UserRole } from '@unicore/shared-types';
import type { NavItem } from '@/types/navigation';

export const menuItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/', roles: ['*'] },
  { label: 'AI Agents', icon: Bot, href: '/agents', roles: [UserRole.Owner, UserRole.Operator] },
  {
    label: 'Contacts',
    icon: Users,
    href: '/erp/contacts',
    roles: [UserRole.Owner, UserRole.Operator, UserRole.Marketer],
  },
  {
    label: 'Orders',
    icon: ShoppingCart,
    href: '/erp/orders',
    roles: [UserRole.Owner, UserRole.Operator],
  },
  {
    label: 'Inventory',
    icon: Package,
    href: '/erp/inventory',
    roles: [UserRole.Owner, UserRole.Operator],
  },
  {
    label: 'Invoicing',
    icon: FileText,
    href: '/erp/invoicing',
    roles: [UserRole.Owner, UserRole.Finance],
  },
  {
    label: 'Workflows',
    icon: GitBranch,
    href: '/workflows',
    roles: [UserRole.Owner, UserRole.Operator],
  },
  { label: 'Settings', icon: Settings, href: '/settings', roles: [UserRole.Owner] },
];

export function filterMenuByRole(role: UserRole): NavItem[] {
  return menuItems.filter((item) => item.roles.includes('*') || item.roles.includes(role));
}
