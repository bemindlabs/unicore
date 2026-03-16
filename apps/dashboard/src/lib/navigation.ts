import {
  Activity,
  Bot,
  ClipboardList,
  DollarSign,
  FileText,
  GitBranch,
  LayoutDashboard,
  Package,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  TrendingUp,
  Users,
  UsersRound,
} from 'lucide-react';
import { UserRole } from '@unicore/shared-types';
import type { NavItem, NavSection } from '@/types/navigation';

export const menuSections: NavSection[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/', roles: ['*'] },
      { label: 'AI Agents', icon: Bot, href: '/agents', roles: [UserRole.Owner, UserRole.Operator] },
      {
        label: 'Workflows',
        icon: GitBranch,
        href: '/workflows',
        roles: [UserRole.Owner, UserRole.Operator],
      },
      {
        label: 'Tasks Board',
        icon: ClipboardList,
        href: '/tasks',
        roles: [UserRole.Owner, UserRole.Operator],
      },
    ],
  },
  {
    label: 'ERP',
    items: [
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
        label: 'Expenses',
        icon: DollarSign,
        href: '/erp/expenses',
        roles: [UserRole.Owner, UserRole.Finance],
      },
      {
        label: 'Reports',
        icon: TrendingUp,
        href: '/erp/reports',
        roles: [UserRole.Owner, UserRole.Operator],
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Users', icon: UsersRound, href: '/admin/users', roles: [UserRole.Owner] },
      { label: 'Roles & Access', icon: Shield, href: '/admin/roles', roles: [UserRole.Owner] },
      { label: 'Audit Logs', icon: ScrollText, href: '/admin/audit-logs', roles: [UserRole.Owner] },
      { label: 'System Health', icon: Activity, href: '/admin/health', roles: [UserRole.Owner] },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', icon: Settings, href: '/settings', roles: [UserRole.Owner] },
    ],
  },
];

export const menuItems: NavItem[] = menuSections.flatMap((s) => s.items);

export function filterMenuByRole(role: UserRole): NavItem[] {
  return menuItems.filter((item) => item.roles.includes('*') || item.roles.includes(role));
}

export function filterSectionsByRole(role: UserRole): NavSection[] {
  return menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => item.roles.includes('*') || item.roles.includes(role),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
