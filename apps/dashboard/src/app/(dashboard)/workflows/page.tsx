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

type TriggerType = 'manual' | 'schedule' | 'event';
type WorkflowStatus = 'active' | 'inactive' | 'draft';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  triggerType: TriggerType;
  enabled: boolean;
}

const TRIGGER_ICONS: Record<TriggerType, React.ComponentType<{ className?: string }>> = {
  manual: MousePointer,
  schedule: Calendar,
  event: Zap,
};

const TRIGGER_LABELS: Record<TriggerType, string> = {
  manual: 'Manual',
  schedule: 'Scheduled',
  event: 'Event-driven',
};

const STATUS_VARIANTS: Record<WorkflowStatus, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  inactive: 'outline',
  draft: 'secondary',
};

export default function WorkflowsPage() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get<WorkflowTemplate[]>('/api/proxy/workflow/templates')
      .then((data) => {
        if (mounted) setTemplates(data);
      })
      .catch(() => {
        if (mounted) setTemplates([]);
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
      await api.put(`/api/proxy/workflow/templates/${id}`, { enabled });
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, enabled, status: enabled ? 'active' : 'inactive' } : t)),
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

      {templates.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
          No workflow templates found
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              <CardTitle>Workflow Templates</CardTitle>
            </div>
            <CardDescription>
              {templates.filter((t) => t.enabled).length} of {templates.length} workflows active
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.map((template) => {
              const TriggerIcon = TRIGGER_ICONS[template.triggerType];
              return (
                <div
                  key={template.id}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <TriggerIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={STATUS_VARIANTS[template.status]} className="text-xs">
                          {template.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {TRIGGER_LABELS[template.triggerType]}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={template.enabled}
                    disabled={togglingId === template.id}
                    onCheckedChange={(enabled) => handleToggle(template.id, enabled)}
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
