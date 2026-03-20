import Link from 'next/link';
import {
  BookOpen,
  Bot,
  ChevronRight,
  CreditCard,
  Crown,
  Globe,
  Settings,
  Puzzle,
  Wand2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@unicore/ui';
const SETTINGS_LINKS = [
  {
    href: '/settings/erp',
    icon: BookOpen,
    title: 'ERP Modules',
    description: 'Enable or disable ERP modules for your organisation',
  },
  {
    href: '/settings/integrations',
    icon: Puzzle,
    title: 'Integrations',
    description: 'Connect third-party services and external platforms',
  },
  {
    href: '/settings/ai',
    icon: Bot,
    title: 'AI Configuration',
    description: 'Manage LLM API keys, providers, and model preferences',
  },
  {
    href: '/settings/agents',
    icon: Bot,
    title: 'OpenClaw Agents',
    description: 'Monitor AI agents, heartbeat status, and pub/sub channels',
  },
  {
    href: '/settings/domains',
    icon: Globe,
    title: 'Custom Domains',
    description: 'Add and verify custom domains with SSL certificate management',
  },
  {
    href: '/settings/license',
    icon: Crown,
    title: 'License',
    description: 'View your edition, usage limits, and upgrade to Pro',
  },
  {
    href: '/settings/billing',
    icon: CreditCard,
    title: 'Billing & Payments',
    description: 'Manage subscription, payment methods, invoices, and Web3 wallet',
  },
  {
    href: '/wizard',
    icon: Wand2,
    title: 'Setup Wizard',
    description: 'Re-run the initial configuration wizard at any time',
  },
] as const;

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Configure your UniCore platform</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_LINKS.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href}>
            <Card className="h-full cursor-pointer transition-colors hover:bg-muted/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
