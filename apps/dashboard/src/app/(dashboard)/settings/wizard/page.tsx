'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Building2,
  Package,
  Plug,
  RefreshCcw,
  Users,
} from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Separator,
} from '@unicore/ui';
import { Breadcrumb } from '@/components/layout/breadcrumb';

interface WizardStep {
  step: number;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    step: 1,
    title: 'Business Profile',
    description: 'Set your business name, type, currency, and language',
    href: '/settings',
    icon: Building2,
  },
  {
    step: 2,
    title: 'Team & Roles',
    description: 'Define who is on the team and what they can access',
    href: '/admin/users',
    icon: Users,
  },
  {
    step: 3,
    title: 'AI Agents',
    description: 'Choose which agents to activate and set their autonomy',
    href: '/agents',
    icon: Bot,
  },
  {
    step: 4,
    title: 'ERP Modules',
    description: 'Enable only the modules your business needs',
    href: '/settings/erp',
    icon: Package,
  },
  {
    step: 5,
    title: 'Integrations',
    description: 'Connect external services like LINE, Stripe, and Shopify',
    href: '/settings/integrations',
    icon: Plug,
  },
];

export default function SettingsWizardPage() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleFullReset = useCallback(async () => {
    setIsResetting(true);
    try {
      // TODO: api.post('/settings/wizard/reset')
      await new Promise((r) => setTimeout(r, 800));
      // Redirect to wizard entry point
      router.push('/wizard');
    } finally {
      setIsResetting(false);
      setConfirmOpen(false);
    }
  }, [router]);

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-primary" />
            <CardTitle>Re-run Bootstrap Wizard</CardTitle>
          </div>
          <CardDescription>
            Jump directly to any wizard step to update your configuration, or re-run the full wizard
            to start fresh.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {WIZARD_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <button
                key={step.step}
                type="button"
                onClick={() => router.push(step.href)}
                className="group flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {step.step}
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Separator />

      {/* Danger zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Re-running the full wizard will reset all settings to defaults. Team members, agent
            configurations, integrations, and ERP module selections will be cleared.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>This action cannot be undone</AlertTitle>
            <AlertDescription>
              All existing configuration will be lost. Your data (contacts, orders, invoices) will
              not be deleted — only the platform settings will be reset.
            </AlertDescription>
          </Alert>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <RefreshCcw className="mr-2 h-4 w-4" />
                Re-run Full Wizard
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Re-run the Bootstrap Wizard?</DialogTitle>
                <DialogDescription>
                  This will reset all platform settings. You will be guided through the 5-step
                  wizard again. Your business data will remain intact.
                </DialogDescription>
              </DialogHeader>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Are you sure?</AlertTitle>
                <AlertDescription>
                  Team members, agent configs, integrations, and ERP module selections will be
                  cleared.
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleFullReset}
                  disabled={isResetting}
                >
                  {isResetting ? 'Resetting…' : 'Yes, Reset & Re-run Wizard'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
