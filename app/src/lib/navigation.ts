import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  ClipboardList,
  DollarSign,
  FileText,
  GitBranch,
  Globe,
  Inbox,
  KeyRound,
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Monitor,
  Package,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Terminal,
  TrendingUp,
  Users,
  UsersRound,
  Wand2,
  LineChart,
} from 'lucide-react';
import { UserRole } from '@bemindlabs/unicore-shared-types';
import type { NavItem, NavSection } from '@/types/navigation';

export const menuSections: NavSection[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/', roles: ['*'] },
      { label: 'AI Agents', icon: Bot, href: '/agents', roles: [UserRole.Owner, UserRole.Operator] },
      {
        label: 'Agent Builder',
        icon: Wand2,
        href: '/agent-builder',
        roles: [UserRole.Owner, UserRole.Operator],
        license: { tier: 'pro', feature: 'agentBuilder', upgradeLabel: 'Pro' },
      },
      {
        label: 'Workflows',
        icon: GitBranch,
        href: '/workflows',
        roles: [UserRole.Owner, UserRole.Operator],
        license: { tier: 'pro', feature: 'advancedWorkflows', upgradeLabel: 'Pro' },
      },
      {
        label: 'Tasks Board',
        icon: ClipboardList,
        href: '/tasks',
        roles: [UserRole.Owner, UserRole.Operator],
      },
      {
        label: 'Knowledge Base',
        icon: BookOpen,
        href: '/knowledge',
        roles: [UserRole.Owner, UserRole.Operator],
      },
      {
        label: 'AI Chat',
        icon: MessageSquare,
        href: '/chat-history',
        roles: [UserRole.Owner, UserRole.Operator],
      },
      {
        label: 'Conversations',
        icon: Inbox,
        href: '/conversations',
        roles: [UserRole.Owner, UserRole.Operator],
      },
      {
        label: 'All Channels',
        icon: Megaphone,
        href: '/channels',
        roles: [UserRole.Owner, UserRole.Operator],
        license: { tier: 'pro', feature: 'channels', upgradeLabel: 'Pro' },
      },
      {
        label: 'Conv. Analytics',
        icon: LineChart,
        href: '/conversations/analytics',
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
      {
        label: 'Roles & Access',
        icon: Shield,
        href: '/admin/roles',
        roles: [UserRole.Owner],
        license: { tier: 'pro', feature: 'rbac', upgradeLabel: 'Pro' },
      },
      {
        label: 'SSO',
        icon: KeyRound,
        href: '/admin/sso',
        roles: [UserRole.Owner],
        license: { tier: 'pro', feature: 'sso', upgradeLabel: 'Pro' },
      },
      {
        label: 'Custom Domains',
        icon: Globe,
        href: '/settings/domains',
        roles: [UserRole.Owner],
        license: { tier: 'pro', feature: 'customDomains', upgradeLabel: 'Pro' },
      },
      {
        label: 'Audit Logs',
        icon: ScrollText,
        href: '/admin/audit-logs',
        roles: [UserRole.Owner],
        license: { tier: 'pro', feature: 'audit', upgradeLabel: 'Pro' },
      },
      { label: 'System Health', icon: Activity, href: '/admin/health', roles: [UserRole.Owner] },
      { label: 'System Terminal', icon: Terminal, href: '/admin/terminal', roles: [UserRole.Owner] },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', icon: Settings, href: '/settings', roles: [UserRole.Owner] },
    ],
  },
  {
    label: 'Add-ons',
    items: [
      {
        label: 'Virtual Office',
        icon: Monitor,
        href: process.env.NEXT_PUBLIC_VIRTUAL_OFFICE_URL ?? 'https://vo-unicore-demo.bemind.tech',
        roles: [UserRole.Owner, UserRole.Operator],
        license: { tier: 'pro', feature: 'featVirtualOffice', upgradeLabel: 'Pro' },
        external: true,
      },
      {
        label: 'Geek CLI',
        icon: Terminal,
        href: process.env.NEXT_PUBLIC_GEEK_PORTAL_URL ?? 'https://geek-unicore-demo.bemind.tech',
        roles: [UserRole.Owner, UserRole.Operator],
        license: { tier: 'pro', feature: 'featGeekCli', upgradeLabel: 'Pro' },
        external: true,
      },
      {
        label: 'AI-DLC',
        icon: Zap,
        href: process.env.NEXT_PUBLIC_DLC_PORTAL_URL ?? 'https://dlc-unicore-demo.bemind.tech',
        roles: [UserRole.Owner, UserRole.Operator],
        license: { tier: 'pro', feature: 'featAiDlc', upgradeLabel: 'Pro' },
        external: true,
      },
    ],
  },
  {
    label: 'Enterprise',
    items: [
      {
        label: 'Platform Overview',
        icon: Globe,
        href: '/platform-admin',
        roles: [UserRole.Owner],
        license: { tier: 'enterprise', upgradeLabel: 'Enterprise' },
      },
      {
        label: 'Multi-Tenancy',
        icon: Building2,
        href: '/platform-admin/tenants',
        roles: [UserRole.Owner],
        license: { tier: 'enterprise', upgradeLabel: 'Enterprise' },
      },
      {
        label: 'Compliance',
        icon: Shield,
        href: '/platform-admin/compliance',
        roles: [UserRole.Owner],
        license: { tier: 'enterprise', upgradeLabel: 'Enterprise' },
      },
      {
        label: 'HA Cluster',
        icon: Activity,
        href: '/platform-admin/health',
        roles: [UserRole.Owner],
        license: { tier: 'enterprise', upgradeLabel: 'Enterprise' },
      },
      {
        label: 'Analytics',
        icon: BarChart3,
        href: '/platform-admin/analytics',
        roles: [UserRole.Owner],
        license: { tier: 'enterprise', upgradeLabel: 'Enterprise' },
      },
      {
        label: 'Platform Settings',
        icon: Shield,
        href: '/platform-admin/settings',
        roles: [UserRole.Owner],
        license: { tier: 'enterprise', upgradeLabel: 'Enterprise' },
      },
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

/**
 * Returns true when a nav item should be shown as locked (upgrade required).
 */
export function isNavItemLocked(
  item: NavItem,
  isPro: boolean,
  edition: string,
  hasFeature: (f: string) => boolean,
): boolean {
  if (!item.license) return false;
  if (item.license.tier === 'enterprise') return edition !== 'enterprise';
  if (item.license.tier === 'pro') {
    if (item.license.feature) return !hasFeature(item.license.feature);
    return !isPro;
  }
  return false;
}
