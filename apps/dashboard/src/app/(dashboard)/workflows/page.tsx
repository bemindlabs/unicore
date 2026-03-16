'use client';

import { useCallback, useEffect, useState } from 'react';
import { GitBranch, Calendar, Zap, MousePointer } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  toast,
} from '@unicore/ui';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types aligned with the workflow service's WorkflowDefinition schema
// ---------------------------------------------------------------------------

type ServiceTriggerType =
  | 'erp.order.created'
  | 'erp.order.updated'
  | 'erp.order.fulfilled'
  | 'erp.inventory.low'
  | 'erp.inventory.restocked'
  | 'erp.invoice.created'
  | 'erp.invoice.overdue'
  | 'erp.invoice.paid'
  | 'schedule.cron'
  | 'webhook'
  | 'manual';

/** Simplified trigger category for the UI. */
type TriggerCategory = 'manual' | 'schedule' | 'event';

type WorkflowStatus = 'active' | 'inactive' | 'draft';

interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schemaVersion: number;
  trigger: {
    type: ServiceTriggerType;
    conditions?: unknown[];
    cron?: string;
  };
  actions: unknown[];
  createdAt: string;
  updatedAt: string;
}

/** The definitions endpoint may return a plain array or a paginated envelope. */
type DefinitionsResponse =
  | WorkflowDefinition[]
  | { data: WorkflowDefinition[]; meta?: unknown; total?: number; success?: boolean };

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function triggerCategory(type: ServiceTriggerType): TriggerCategory {
  if (type === 'manual') return 'manual';
  if (type === 'schedule.cron') return 'schedule';
  return 'event';
}

function deriveStatus(def: WorkflowDefinition): WorkflowStatus {
  if (def.enabled) return 'active';
  return 'inactive';
}

const TRIGGER_ICONS: Record<TriggerCategory, React.ComponentType<{ className?: string }>> = {
  manual: MousePointer,
  schedule: Calendar,
  event: Zap,
};

const TRIGGER_LABELS: Record<TriggerCategory, string> = {
  manual: 'Manual',
  schedule: 'Scheduled',
  event: 'Event-driven',
};

const STATUS_VARIANTS: Record<WorkflowStatus, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  inactive: 'outline',
  draft: 'secondary',
};

/** Extract the definitions array regardless of response shape. */
function unwrapDefinitions(raw: DefinitionsResponse): WorkflowDefinition[] {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;
  return [];
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function WorkflowsPage() {
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get<DefinitionsResponse>('/api/proxy/workflow/definitions')
      .then((raw) => {
        if (mounted) setDefinitions(unwrapDefinitions(raw));
      })
      .catch(() => {
        if (mounted) setDefinitions([]);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    setTogglingId(id);
    try {
      await api.post('/api/proxy/workflow/definitions', {
        id,
        enabled,
      });
      setDefinitions((prev) =>
        prev.map((d) => (d.id === id ? { ...d, enabled } : d)),
      );
      toast({
        title: enabled ? 'Workflow enabled' : 'Workflow disabled',
        description: `Workflow has been ${enabled ? 'activated' : 'deactivated'}.`,
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to update workflow status.' });
    } finally {
      setTogglingId(null);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground animate-pulse">
        Loading workflows...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GitBranch className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">Automate your business processes</p>
        </div>
      </div>

      {definitions.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
          No workflow definitions found
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              <CardTitle>Workflow Definitions</CardTitle>
            </div>
            <CardDescription>
              {definitions.filter((d) => d.enabled).length} of {definitions.length} workflows active
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {definitions.map((def) => {
              const category = triggerCategory(def.trigger.type);
              const status = deriveStatus(def);
              const TriggerIcon = TRIGGER_ICONS[category];
              return (
                <div
                  key={def.id}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <TriggerIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{def.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {def.description ?? 'No description'}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={STATUS_VARIANTS[status]} className="text-xs">
                          {status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {TRIGGER_LABELS[category]}
                        </span>
                        <span className="text-xs text-muted-foreground/60">
                          {def.trigger.type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={def.enabled}
                    disabled={togglingId === def.id}
                    onCheckedChange={(enabled) => handleToggle(def.id, enabled)}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
