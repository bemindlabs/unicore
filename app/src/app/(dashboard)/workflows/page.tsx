'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  GitBranch,
  Calendar,
  Zap,
  MousePointer,
  Plus,
  Trash2,
  Play,
  Pencil,
  X,
} from 'lucide-react';
import {
  Badge,
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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  toast,
} from '@bemindlabs/unicore-ui';
import { api } from '@/lib/api';
import { uuid } from '@/lib/uuid';

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

interface WorkflowAction {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

interface WorkflowTrigger {
  type: ServiceTriggerType | 'event' | 'schedule';
  event?: string;
  cron?: string;
  conditions?: unknown[];
}

interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schemaVersion: number;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  createdAt: string;
  updatedAt: string;
}

/** The definitions endpoint may return a plain array or a paginated envelope. */
type DefinitionsResponse =
  | WorkflowDefinition[]
  | { data: WorkflowDefinition[]; meta?: unknown; total?: number; success?: boolean };

// ---------------------------------------------------------------------------
// Action types available in the select
//
// UI constant — mirrors the executor classes registered in the workflow service:
//   call-agent.executor.ts, send-notification.executor.ts,
//   send-telegram.executor.ts, send-line.executor.ts, update-erp.executor.ts
//
// The workflow service does not expose a /action-types endpoint; these values
// must remain in sync with the ActionExecutorService registry in
//   unicore/services/workflow/src/engine/action-executor.service.ts
// ---------------------------------------------------------------------------

const ACTION_TYPES = [
  { value: 'call_agent', label: 'Call Agent' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'send_telegram', label: 'Send Telegram' },
  { value: 'send_line', label: 'Send LINE' },
  { value: 'update_erp', label: 'Update ERP' },
] as const;

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function triggerCategory(type: string): TriggerCategory {
  if (type === 'manual') return 'manual';
  if (type === 'schedule.cron' || type === 'schedule') return 'schedule';
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
// Form state types
// ---------------------------------------------------------------------------

interface ActionFormEntry {
  id: string;
  type: string;
  configJson: string;
}

interface WorkflowFormState {
  id: string;
  name: string;
  description: string;
  triggerType: 'event' | 'schedule' | 'manual';
  triggerEvent: string;
  triggerCron: string;
  actions: ActionFormEntry[];
}

function emptyFormState(): WorkflowFormState {
  return {
    id: uuid(),
    name: '',
    description: '',
    triggerType: 'manual',
    triggerEvent: '',
    triggerCron: '',
    actions: [],
  };
}

function formStateFromDefinition(def: WorkflowDefinition): WorkflowFormState {
  const category = triggerCategory(def.trigger.type);
  return {
    id: def.id,
    name: def.name,
    description: def.description ?? '',
    triggerType: category,
    triggerEvent:
      category === 'event'
        ? def.trigger.event ?? (def.trigger.type !== 'event' ? def.trigger.type : '')
        : '',
    triggerCron: def.trigger.cron ?? '',
    actions: (def.actions ?? []).map((a) => ({
      id: a.id ?? uuid(),
      type: a.type ?? 'call_agent',
      configJson: JSON.stringify(a.config ?? {}, null, 2),
    })),
  };
}

// ---------------------------------------------------------------------------
// Workflow Form Dialog (Create / Edit)
// ---------------------------------------------------------------------------

function WorkflowFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: WorkflowFormState;
  onSaved: (def: WorkflowDefinition) => void;
}) {
  const [form, setForm] = useState<WorkflowFormState>(initial);
  const [saving, setSaving] = useState(false);
  const isEdit = initial.name !== '';

  // Reset form when dialog opens with new initial values
  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  function updateField<K extends keyof WorkflowFormState>(key: K, value: WorkflowFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addAction() {
    setForm((prev) => ({
      ...prev,
      actions: [...prev.actions, { id: uuid(), type: 'call_agent', configJson: '{}' }],
    }));
  }

  function removeAction(id: string) {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.filter((a) => a.id !== id),
    }));
  }

  function updateAction(id: string, field: keyof ActionFormEntry, value: string) {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: 'Validation', description: 'Name is required.' });
      return;
    }
    if (form.triggerType === 'event' && !form.triggerEvent.trim()) {
      toast({ title: 'Validation', description: 'Event name is required for event triggers.' });
      return;
    }
    if (form.triggerType === 'schedule' && !form.triggerCron.trim()) {
      toast({ title: 'Validation', description: 'Cron expression is required for schedule triggers.' });
      return;
    }

    // Parse action configs
    let parsedActions: WorkflowAction[];
    try {
      parsedActions = form.actions.map((a) => ({
        id: a.id,
        type: a.type,
        config: JSON.parse(a.configJson || '{}'),
      }));
    } catch {
      toast({ title: 'Validation', description: 'Invalid JSON in action config.' });
      return;
    }

    // Build trigger
    let trigger: WorkflowTrigger;
    if (form.triggerType === 'event') {
      trigger = { type: 'event', event: form.triggerEvent.trim() };
    } else if (form.triggerType === 'schedule') {
      trigger = { type: 'schedule', cron: form.triggerCron.trim() };
    } else {
      trigger = { type: 'manual' };
    }

    const now = new Date().toISOString();
    const payload: WorkflowDefinition = {
      id: form.id,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      enabled: isEdit ? undefined! : false, // preserve for edit, default false for create
      schemaVersion: 1,
      trigger,
      actions: parsedActions,
      createdAt: isEdit ? undefined! : now,
      updatedAt: now,
    };

    // Remove undefined fields
    const cleanPayload = JSON.parse(JSON.stringify(payload));

    setSaving(true);
    try {
      const result = await api.post<WorkflowDefinition>(
        '/api/proxy/workflow/definitions',
        cleanPayload,
      );
      toast({
        title: isEdit ? 'Workflow updated' : 'Workflow created',
        description: `"${form.name}" has been ${isEdit ? 'updated' : 'created'}.`,
      });
      onSaved(result ?? { ...cleanPayload });
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: `Failed to ${isEdit ? 'update' : 'create'} workflow.` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Workflow' : 'New Workflow'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modify the workflow definition and save.'
              : 'Create a new workflow automation.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="wf-name">Name *</Label>
            <Input
              id="wf-name"
              placeholder="My Workflow"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="wf-desc">Description</Label>
            <Textarea
              id="wf-desc"
              placeholder="Optional description..."
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={2}
            />
          </div>

          {/* Trigger Type */}
          <div className="space-y-2">
            <Label>Trigger Type</Label>
            <Select
              value={form.triggerType}
              onValueChange={(v) => updateField('triggerType', v as WorkflowFormState['triggerType'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select trigger type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="schedule">Schedule</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional: Event name */}
          {form.triggerType === 'event' && (
            <div className="space-y-2">
              <Label htmlFor="wf-event">Event Name</Label>
              <Input
                id="wf-event"
                placeholder="e.g. erp.order.created"
                value={form.triggerEvent}
                onChange={(e) => updateField('triggerEvent', e.target.value)}
              />
            </div>
          )}

          {/* Conditional: Cron expression */}
          {form.triggerType === 'schedule' && (
            <div className="space-y-2">
              <Label htmlFor="wf-cron">Cron Expression</Label>
              <Input
                id="wf-cron"
                placeholder="e.g. 0 9 * * *"
                value={form.triggerCron}
                onChange={(e) => updateField('triggerCron', e.target.value)}
              />
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Actions</Label>
              <Button type="button" variant="outline" size="sm" onClick={addAction}>
                <Plus className="mr-1 h-3 w-3" />
                Add Action
              </Button>
            </div>

            {form.actions.length === 0 && (
              <p className="text-sm text-muted-foreground">No actions added yet.</p>
            )}

            {form.actions.map((action, idx) => (
              <div key={action.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Action {idx + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeAction(action.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={action.type}
                    onValueChange={(v) => updateAction(action.id, 'type', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((at) => (
                        <SelectItem key={at.value} value={at.value}>
                          {at.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Config (JSON)</Label>
                  <Textarea
                    placeholder="{}"
                    value={action.configJson}
                    onChange={(e) => updateAction(action.id, 'configJson', e.target.value)}
                    rows={3}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Workflow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Dialog
// ---------------------------------------------------------------------------

function DeleteConfirmDialog({
  open,
  onOpenChange,
  workflowName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowName: string;
  onConfirm: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Workflow</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;{workflowName}&rdquo;? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function WorkflowsPage() {
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<WorkflowFormState>(emptyFormState);

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowDefinition | null>(null);

  const fetchDefinitions = useCallback(() => {
    setIsLoading(true);
    api
      .get<DefinitionsResponse>('/api/proxy/workflow/definitions')
      .then((raw) => {
        setDefinitions(unwrapDefinitions(raw));
      })
      .catch(() => setDefinitions([]))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchDefinitions();
  }, [fetchDefinitions]);

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

  const handleCreate = useCallback(() => {
    setFormInitial(emptyFormState());
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((def: WorkflowDefinition) => {
    setFormInitial(formStateFromDefinition(def));
    setFormOpen(true);
  }, []);

  const handleSaved = useCallback(
    (saved: WorkflowDefinition) => {
      setDefinitions((prev) => {
        const idx = prev.findIndex((d) => d.id === saved.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...prev[idx], ...saved };
          return updated;
        }
        return [...prev, saved];
      });
    },
    [],
  );

  const handleDeleteClick = useCallback((def: WorkflowDefinition) => {
    setDeleteTarget(def);
    setDeleteOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/proxy/workflow/definitions/${deleteTarget.id}`);
      setDefinitions((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast({
        title: 'Workflow deleted',
        description: `"${deleteTarget.name}" has been removed.`,
      });
      setDeleteOpen(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to delete workflow.' });
    }
  }, [deleteTarget]);

  const handleTrigger = useCallback(async (def: WorkflowDefinition) => {
    setTriggeringId(def.id);
    try {
      await api.post('/api/proxy/workflow/trigger', { workflowId: def.id });
      toast({
        title: 'Workflow triggered',
        description: `"${def.name}" has been triggered successfully.`,
      });
    } catch {
      toast({ title: 'Error', description: `Failed to trigger "${def.name}".` });
    } finally {
      setTriggeringId(null);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
            <p className="text-muted-foreground">Automate your business processes</p>
          </div>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Workflow
        </Button>
      </div>

      {definitions.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <GitBranch className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">No workflows yet</p>
            <p className="text-xs">Automate your business processes with workflow rules</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first workflow
          </Button>
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
                  <div
                    className="flex flex-1 cursor-pointer items-center gap-4"
                    onClick={() => handleEdit(def)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleEdit(def);
                    }}
                  >
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

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Run workflow"
                      disabled={triggeringId === def.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTrigger(def);
                      }}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit workflow"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(def);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete workflow"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(def);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <Switch
                      checked={def.enabled}
                      disabled={togglingId === def.id}
                      onCheckedChange={(enabled) => handleToggle(def.id, enabled)}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <WorkflowFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={formInitial}
        onSaved={handleSaved}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        workflowName={deleteTarget?.name ?? ''}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
