'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from '@unicore/ui';
import { useState } from 'react';

import { useWizardState } from '@/hooks/use-wizard-state';
import { provisionWorkspace } from '@/lib/api';
import type { ProvisionRequest, ProvisionResult } from '@/lib/api';
import { AGENT_DEFINITIONS, ERP_MODULES, STEP_LABELS } from '@/types/wizard';

export function StepReview() {
  const { state, prevStep, goToStep } = useWizardState();
  const [provisioning, setProvisioning] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);

  const enabledAgents = state.agents.filter((a) => a.enabled);
  const enabledModules = ERP_MODULES.filter((m) => state.erp[m.key]);
  const enabledIntegrations = state.integrations.filter((i) => i.enabled);

  async function handleProvision() {
    setProvisioning(true);
    setResult(null);

    const request: ProvisionRequest = {
      bootstrapSecret: state.bootstrapSecret ?? '',
      businessName: state.business.name,
      template: state.business.template,
      industry: state.business.industry,
      locale: state.business.locale,
      currency: state.business.currency,
      timezone: state.business.timezone,
      adminName: state.admin?.name ?? '',
      adminEmail: state.admin?.email ?? '',
      adminPassword: state.admin?.password ?? '',
    };

    try {
      const res = await provisionWorkspace(request);
      setResult(res);
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Provisioning failed' } as ProvisionResult);
    } finally {
      setProvisioning(false);
    }
  }

  if (result?.success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div className="text-5xl">🚀</div>
        <h2 className="text-2xl font-bold">Workspace Provisioned!</h2>
        <p className="text-muted-foreground max-w-md">
          Your UniCore workspace is being set up. You'll be redirected to the dashboard shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Review & Launch</h2>
        <p className="text-muted-foreground mt-1">
          Review your configuration before provisioning your workspace.
        </p>
      </div>

      {/* Business Summary */}
      <SectionCard title="Business Profile" step={0} onEdit={goToStep}>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Name</div>
          <div className="font-medium">{state.business.name || '—'}</div>
          <div className="text-muted-foreground">Type</div>
          <div className="font-medium capitalize">{state.business.template}</div>
          <div className="text-muted-foreground">Currency</div>
          <div className="font-medium">{state.business.currency}</div>
          <div className="text-muted-foreground">Language</div>
          <div className="font-medium">{state.business.locale}</div>
          <div className="text-muted-foreground">Timezone</div>
          <div className="font-medium">{state.business.timezone}</div>
        </div>
      </SectionCard>

      {/* Team Summary */}
      <SectionCard title="Team & Roles" step={1} onEdit={goToStep}>
        {state.team.length > 0 ? (
          <div className="space-y-1">
            {state.team.map((m) => (
              <div key={m.email} className="flex items-center justify-between text-sm">
                <span>{m.email}</span>
                <Badge variant="secondary" className="text-xs">{m.role}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No team members added</p>
        )}
      </SectionCard>

      {/* Agents Summary */}
      <SectionCard title="AI Agents" step={2} onEdit={goToStep}>
        {enabledAgents.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {enabledAgents.map((a) => {
              const def = AGENT_DEFINITIONS.find((d) => d.type === a.type);
              return (
                <Badge key={a.type} variant="secondary">
                  {def?.name ?? a.type}
                </Badge>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No agents enabled</p>
        )}
      </SectionCard>

      {/* ERP Summary */}
      <SectionCard title="ERP Modules" step={3} onEdit={goToStep}>
        <div className="flex flex-wrap gap-2">
          {enabledModules.map((m) => (
            <Badge key={m.key} variant="secondary">{m.label}</Badge>
          ))}
        </div>
      </SectionCard>

      {/* Integrations Summary */}
      <SectionCard title="Integrations" step={4} onEdit={goToStep}>
        {enabledIntegrations.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {enabledIntegrations.map((i) => (
              <Badge key={i.provider} variant="secondary">{i.name}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No integrations enabled</p>
        )}
      </SectionCard>

      <Separator />

      {result && !result.success && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.message ?? 'Provisioning failed. Please try again.'}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={prevStep}>
          Back
        </Button>
        <Button onClick={handleProvision} disabled={provisioning}>
          {provisioning ? 'Provisioning...' : 'Launch Workspace'}
        </Button>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  onEdit: (step: number) => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => onEdit(step)} className="text-xs h-7">
          Edit
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {children}
      </CardContent>
    </Card>
  );
}
