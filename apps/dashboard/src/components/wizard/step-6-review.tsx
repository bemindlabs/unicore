"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from "@unicore/ui";
import { useState } from "react";

import { useBranding } from "@/components/BrandingProvider";
import { useWizardState } from "@/hooks/use-wizard-state";
import { provisionWorkspace } from "@/lib/bootstrap-api";
import type { ProvisionRequest, ProvisionResult } from "@/lib/bootstrap-api";
import { AGENT_DEFINITIONS, ERP_MODULES } from "@/types/wizard";

export function StepReview() {
  const { state, prevStep, goToStep } = useWizardState();
  const [provisioning, setProvisioning] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);

  const enabledAgents = state.agents.filter((a) => a.enabled);
  const enabledModules = ERP_MODULES.filter((m) => state.erp[m.key]);
  const enabledIntegrations = state.integrations.filter((i) => i.enabled);

  async function handleProvision() {
    // Client-side validation
    const adminName = state.admin?.name?.trim() ?? "";
    const adminEmail = state.admin?.email?.trim() ?? "";
    const adminPassword = state.admin?.password ?? "";
    if (!adminName) {
      setResult({
        success: false,
        message: "Admin name is required",
      } as ProvisionResult);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      setResult({
        success: false,
        message: "A valid admin email is required",
      } as ProvisionResult);
      return;
    }
    if (adminPassword.length < 8) {
      setResult({
        success: false,
        message: "Admin password must be at least 8 characters",
      } as ProvisionResult);
      return;
    }

    setProvisioning(true);
    setResult(null);

    const request: ProvisionRequest = {
      bootstrapSecret: process.env.NEXT_PUBLIC_BOOTSTRAP_SECRET ?? state.bootstrapSecret ?? "",
      businessName: state.business.name,
      template: state.business.template,
      industry: state.business.industry,
      locale: state.business.locale,
      currency: state.business.currency,
      timezone: state.business.timezone,
      adminName,
      adminEmail,
      adminPassword,
    };

    try {
      const res = await provisionWorkspace(request);
      if (res.success) {
        localStorage.setItem('wizard_completed', 'true');
        // Also save server-side so other browsers/users see it
        try {
          await fetch('/api/v1/settings/wizard-status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: true, completedAt: new Date().toISOString(), timezone: state.business.timezone }),
          });
        } catch {
          // Server save failed — localStorage is fallback
        }
      }
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : "Provisioning failed",
      } as ProvisionResult);
    } finally {
      setProvisioning(false);
    }
  }

  if (result?.success) {
    // Already inside the dashboard — link directly
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
        <div className="text-5xl">🚀</div>
        <h2 className="text-2xl font-bold">Workspace Provisioned!</h2>
        <p className="text-muted-foreground max-w-md">
          Your UniCore workspace is ready. Sign in with{" "}
          <strong>{result.admin?.email}</strong> to get started.
        </p>
        {result.licenseKey ? (
          <Card className="w-full max-w-sm text-left">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Community License Key</p>
              <p className="font-mono text-sm font-medium select-all break-all">
                {result.licenseKey}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700 max-w-sm">
            License could not be generated automatically. You can create one
            later from the admin dashboard.
          </div>
        )}
        <Button asChild size="lg">
          <a href="/login">Go to Dashboard</a>
        </Button>
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

      {/* Admin Account Summary */}
      <SectionCard title="Admin Account" step={1} onEdit={goToStep}>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Name</div>
          <div className="font-medium">{state.admin?.name || "—"}</div>
          <div className="text-muted-foreground">Email</div>
          <div className="font-medium">{state.admin?.email || "—"}</div>
          <div className="text-muted-foreground">Password</div>
          <div className="font-medium">
            {state.admin?.password
              ? "•".repeat(Math.min(state.admin.password.length, 12))
              : "—"}
          </div>
        </div>
      </SectionCard>

      {/* Business Summary */}
      <SectionCard title="Business Profile" step={0} onEdit={goToStep}>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Name</div>
          <div className="font-medium">{state.business.name || "—"}</div>
          <div className="text-muted-foreground">Type</div>
          <div className="font-medium capitalize">
            {state.business.template}
          </div>
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
              <div
                key={m.email}
                className="flex items-center justify-between text-sm"
              >
                <span>{m.email}</span>
                <Badge variant="secondary" className="text-xs">
                  {m.role}
                </Badge>
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
            <Badge key={m.key} variant="secondary">
              {m.label}
            </Badge>
          ))}
        </div>
      </SectionCard>

      {/* Integrations Summary */}
      <SectionCard title="Integrations" step={4} onEdit={goToStep}>
        {enabledIntegrations.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {enabledIntegrations.map((i) => (
              <Badge key={i.provider} variant="secondary">
                {i.name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No integrations enabled
          </p>
        )}
      </SectionCard>

      <Separator />

      {result && !result.success && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.message ?? "Provisioning failed. Please try again."}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={prevStep}>
          Back
        </Button>
        <Button onClick={handleProvision} disabled={provisioning}>
          {provisioning ? "Provisioning..." : "Launch Workspace"}
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(step)}
          className="text-xs h-7"
        >
          Edit
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-2">{children}</CardContent>
    </Card>
  );
}
