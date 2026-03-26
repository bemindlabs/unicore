'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Settings2,
  Users,
  Zap,
} from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
  Switch,
  toast,
} from '@bemindlabs/unicore-ui';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TenantPlan = 'STARTER' | 'GROWTH' | 'ENTERPRISE' | 'CUSTOM';

interface WizardData {
  // Step 1: Basic info
  name: string;
  slug: string;
  ownerEmail: string;
  ownerName: string;
  // Step 2: Plan & config
  plan: TenantPlan;
  customDomain: string;
  // Step 3: Features
  enableSso: boolean;
  enableAdvancedWorkflows: boolean;
  enableCustomDomain: boolean;
  enableApiAccess: boolean;
}

interface CreatedTenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: string;
  ownerEmail: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY: WizardData = {
  name: '',
  slug: '',
  ownerEmail: '',
  ownerName: '',
  plan: 'STARTER',
  customDomain: '',
  enableSso: false,
  enableAdvancedWorkflows: false,
  enableCustomDomain: false,
  enableApiAccess: true,
};

const PLANS: Array<{ value: TenantPlan; label: string; desc: string; color: string }> = [
  { value: 'STARTER', label: 'Starter', desc: '5 users · 5 GB · 10K API/day', color: 'border-zinc-300 bg-zinc-50' },
  { value: 'GROWTH', label: 'Growth', desc: '25 users · 50 GB · 100K API/day', color: 'border-violet-300 bg-violet-50' },
  { value: 'ENTERPRISE', label: 'Enterprise', desc: '200 users · 500 GB · 1M API/day', color: 'border-amber-300 bg-amber-50' },
  { value: 'CUSTOM', label: 'Custom', desc: 'Unlimited · negotiated quotas', color: 'border-pink-300 bg-pink-50' },
];

const STEPS = [
  { id: 1, label: 'Basic Info', icon: Users },
  { id: 2, label: 'Plan', icon: Zap },
  { id: 3, label: 'Features', icon: Settings2 },
  { id: 4, label: 'Review', icon: Check },
];

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 pb-6">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const done = current > step.id;
        const active = current === step.id;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                done
                  ? 'bg-primary text-primary-foreground'
                  : active
                  ? 'border-2 border-primary text-primary'
                  : 'border-2 border-muted text-muted-foreground'
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <span
              className={`hidden text-xs font-medium sm:block ${
                active ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div className={`h-px w-8 ${current > step.id ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function Step1({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (k: keyof WizardData, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="t-name">Tenant Name *</Label>
        <Input
          id="t-name"
          value={data.name}
          onChange={(e) => {
            onChange('name', e.target.value);
            if (!data.slug || data.slug === slugify(data.name)) {
              onChange('slug', slugify(e.target.value));
            }
          }}
          placeholder="Acme Corporation"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="t-slug">Slug *</Label>
        <Input
          id="t-slug"
          value={data.slug}
          onChange={(e) => onChange('slug', slugify(e.target.value))}
          placeholder="acme-corporation"
        />
        <p className="text-xs text-muted-foreground">Used in URLs — lowercase, hyphens only</p>
      </div>
      <Separator />
      <div className="space-y-1">
        <Label htmlFor="t-owner-email">Owner Email *</Label>
        <Input
          id="t-owner-email"
          type="email"
          value={data.ownerEmail}
          onChange={(e) => onChange('ownerEmail', e.target.value)}
          placeholder="admin@acme.com"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="t-owner-name">Owner Name *</Label>
        <Input
          id="t-owner-name"
          value={data.ownerName}
          onChange={(e) => onChange('ownerName', e.target.value)}
          placeholder="John Smith"
        />
      </div>
    </div>
  );
}

function Step2({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (k: keyof WizardData, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Plan *</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <button
              key={plan.value}
              type="button"
              onClick={() => onChange('plan', plan.value)}
              className={`rounded-lg border-2 p-4 text-left transition-all ${
                data.plan === plan.value
                  ? plan.color + ' border-primary shadow-sm'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <p className="font-semibold">{plan.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{plan.desc}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="t-domain">Custom Domain</Label>
        <Input
          id="t-domain"
          value={data.customDomain}
          onChange={(e) => onChange('customDomain', e.target.value)}
          placeholder="app.acme.com"
        />
        <p className="text-xs text-muted-foreground">Optional — leave blank to use default subdomain</p>
      </div>
    </div>
  );
}

function Step3({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (k: keyof WizardData, v: boolean) => void;
}) {
  const features: Array<{
    key: keyof WizardData;
    label: string;
    desc: string;
    plans?: TenantPlan[];
  }> = [
    {
      key: 'enableApiAccess',
      label: 'API Access',
      desc: 'Allow tenant to use the REST API',
    },
    {
      key: 'enableAdvancedWorkflows',
      label: 'Advanced Workflows',
      desc: 'Multi-step automation and conditional logic',
      plans: ['GROWTH', 'ENTERPRISE', 'CUSTOM'],
    },
    {
      key: 'enableSso',
      label: 'Single Sign-On (SSO)',
      desc: 'SAML 2.0 and OIDC authentication',
      plans: ['ENTERPRISE', 'CUSTOM'],
    },
    {
      key: 'enableCustomDomain',
      label: 'Custom Domain',
      desc: 'White-label with a custom domain',
      plans: ['ENTERPRISE', 'CUSTOM'],
    },
  ];

  return (
    <div className="space-y-4">
      {features.map(({ key, label, desc, plans }) => {
        const restricted = plans && !plans.includes(data.plan as TenantPlan);
        return (
          <div
            key={String(key)}
            className={`flex items-center justify-between rounded-lg border p-4 ${restricted ? 'opacity-50' : ''}`}
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{label}</p>
                {plans && (
                  <Badge variant="outline" className="text-xs">
                    {plans.join(' / ')}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              {restricted && (
                <p className="text-xs text-amber-600 mt-1">Requires {plans?.join(' or ')} plan</p>
              )}
            </div>
            <Switch
              checked={data[key] as boolean}
              onCheckedChange={(v) => onChange(key, v)}
              disabled={restricted}
            />
          </div>
        );
      })}
    </div>
  );
}

function Step4({ data }: { data: WizardData }) {
  const planInfo = PLANS.find((p) => p.value === data.plan)!;

  return (
    <div className="space-y-4">
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Ready to provision</AlertTitle>
        <AlertDescription>Review the configuration below before creating the tenant.</AlertDescription>
      </Alert>

      <div className="rounded-lg border divide-y text-sm">
        {[
          { label: 'Name', value: data.name },
          { label: 'Slug', value: data.slug },
          { label: 'Owner', value: `${data.ownerName} <${data.ownerEmail}>` },
          { label: 'Plan', value: `${planInfo.label} — ${planInfo.desc}` },
          { label: 'Custom Domain', value: data.customDomain || 'None' },
          { label: 'API Access', value: data.enableApiAccess ? 'Enabled' : 'Disabled' },
          { label: 'Advanced Workflows', value: data.enableAdvancedWorkflows ? 'Enabled' : 'Disabled' },
          { label: 'SSO', value: data.enableSso ? 'Enabled' : 'Disabled' },
          { label: 'Custom Domain Feature', value: data.enableCustomDomain ? 'Enabled' : 'Disabled' },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function NewTenantPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(EMPTY);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedTenant | null>(null);

  const set = useCallback((k: keyof WizardData, v: string | boolean) => {
    setData((prev) => ({ ...prev, [k]: v }));
  }, []);

  const canNext = useCallback(() => {
    if (step === 1) {
      return data.name.trim() && data.slug.trim() && data.ownerEmail.trim() && data.ownerName.trim();
    }
    if (step === 2) return !!data.plan;
    return true;
  }, [step, data]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const payload = {
        name: data.name.trim(),
        slug: data.slug.trim(),
        ownerEmail: data.ownerEmail.trim(),
        ownerName: data.ownerName.trim(),
        plan: data.plan,
        ...(data.customDomain.trim() && { customDomain: data.customDomain.trim() }),
        features: {
          apiAccess: data.enableApiAccess,
          advancedWorkflows: data.enableAdvancedWorkflows,
          sso: data.enableSso,
          customDomain: data.enableCustomDomain,
        },
      };
      const result = await api.post<CreatedTenant>('/api/v1/admin/tenants', payload);
      setCreated(result);
      toast({ title: `Tenant "${result.name}" created successfully` });
    } catch (err) {
      toast({ title: 'Failed to create tenant', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }, [data]);

  if (created) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-emerald-500" />
            <CardTitle>Tenant Created</CardTitle>
            <CardDescription>
              <strong>{created.name}</strong> has been provisioned and is ready to use.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border divide-y text-sm">
              {[
                { label: 'Tenant ID', value: created.id },
                { label: 'Slug', value: created.slug },
                { label: 'Owner', value: created.ownerEmail },
                { label: 'Plan', value: created.plan },
                { label: 'Status', value: created.status },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Link href={`/platform-admin/tenants/${created.id}`} className="flex-1">
                <Button className="w-full">View Tenant</Button>
              </Link>
              <Link href="/platform-admin/tenants" className="flex-1">
                <Button variant="outline" className="w-full">All Tenants</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/platform-admin/tenants" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Tenant</h1>
          <p className="text-sm text-muted-foreground">Provision a new tenant workspace</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <StepIndicator current={step} />

          <div className="min-h-[320px]">
            {step === 1 && <Step1 data={data} onChange={set as (k: keyof WizardData, v: string) => void} />}
            {step === 2 && <Step2 data={data} onChange={set as (k: keyof WizardData, v: string) => void} />}
            {step === 3 && <Step3 data={data} onChange={set as (k: keyof WizardData, v: boolean) => void} />}
            {step === 4 && <Step4 data={data} />}
          </div>

          <Separator className="my-6" />

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => (step === 1 ? router.push('/platform-admin/tenants') : setStep(step - 1))}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>

            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Create Tenant
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
