'use client';

import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Loader2, Settings } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Switch,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Separator,
  useToast,
} from '@unicore/ui';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// JSON Schema types
// ---------------------------------------------------------------------------

export interface JsonSchemaProperty {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  title?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: 'textarea' | 'password' | string;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface JsonSchema {
  type?: 'object';
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

// ---------------------------------------------------------------------------
// Validation helpers (exported for testing)
// ---------------------------------------------------------------------------

export function validateField(key: string, schema: JsonSchemaProperty, value: unknown): string | null {
  const label = schema.title ?? key;

  if (schema.type === 'string' || !schema.type) {
    const str = (value as string) ?? '';
    if (schema.minLength !== undefined && str.length < schema.minLength) {
      return `${label} must be at least ${schema.minLength} characters.`;
    }
    if (schema.maxLength !== undefined && str.length > schema.maxLength) {
      return `${label} must be at most ${schema.maxLength} characters.`;
    }
    if (schema.pattern && str && !new RegExp(schema.pattern).test(str)) {
      return `${label} has an invalid format.`;
    }
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    const num = Number(value);
    if (isNaN(num)) return `${label} must be a valid number.`;
    if (schema.minimum !== undefined && num < schema.minimum) {
      return `${label} must be ≥ ${schema.minimum}.`;
    }
    if (schema.maximum !== undefined && num > schema.maximum) {
      return `${label} must be ≤ ${schema.maximum}.`;
    }
  }

  return null;
}

export function validateAll(
  schema: JsonSchema,
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  for (const [key, propSchema] of Object.entries(props)) {
    const value = values[key];

    if (required.has(key)) {
      const isEmpty =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);
      if (isEmpty) {
        errors[key] = `${propSchema.title ?? key} is required.`;
        continue;
      }
    }

    if (value !== undefined && value !== null && value !== '') {
      const err = validateField(key, propSchema, value);
      if (err) errors[key] = err;
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Default value builders
// ---------------------------------------------------------------------------

function defaultForSchema(schema: JsonSchemaProperty): unknown {
  if (schema.default !== undefined) return schema.default;
  switch (schema.type) {
    case 'boolean': return false;
    case 'number':
    case 'integer': return '';
    case 'array': return [];
    case 'object': {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(schema.properties ?? {})) {
        obj[k] = defaultForSchema(v);
      }
      return obj;
    }
    default: return '';
  }
}

function buildDefaults(schema: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
    out[key] = defaultForSchema(propSchema);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FieldProps {
  fieldKey: string;
  schema: JsonSchemaProperty;
  value: unknown;
  error?: string;
  required: boolean;
  onChange: (key: string, value: unknown) => void;
}

function ArrayField({ fieldKey, schema, value, error, required, onChange }: FieldProps) {
  const items = (value as string[]) ?? [];
  const itemSchema = schema.items ?? { type: 'string' };

  const add = () => onChange(fieldKey, [...items, '']);
  const update = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    onChange(fieldKey, next);
  };
  const remove = (i: number) => onChange(fieldKey, items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={item}
            type={itemSchema.type === 'number' || itemSchema.type === 'integer' ? 'number' : 'text'}
            placeholder={itemSchema.description ?? `Item ${i + 1}`}
            onChange={(e) => update(i, e.target.value)}
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(i)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="h-7 gap-1 text-xs">
        <Plus className="h-3 w-3" />
        Add {schema.title ?? 'item'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ObjectField({ fieldKey, schema, value, onChange }: FieldProps) {
  const [open, setOpen] = useState(true);
  const obj = (value as Record<string, unknown>) ?? {};

  const handleChange = useCallback(
    (k: string, v: unknown) => onChange(fieldKey, { ...obj, [k]: v }),
    [fieldKey, obj, onChange],
  );

  return (
    <div className="rounded-md border p-3 space-y-3">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-sm font-medium text-left"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {schema.title ?? fieldKey}
        {schema.description && (
          <span className="ml-1 font-normal text-muted-foreground text-xs">— {schema.description}</span>
        )}
      </button>
      {open && (
        <div className="space-y-4 pt-1">
          {Object.entries(schema.properties ?? {}).map(([k, propSchema]) => (
            <SchemaField
              key={k}
              fieldKey={k}
              schema={propSchema}
              value={obj[k]}
              required={(schema.required ?? []).includes(k)}
              onChange={handleChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SchemaField({ fieldKey, schema, value, error, required, onChange }: FieldProps) {
  const label = schema.title ?? fieldKey;
  const isRequired = required;

  // Array
  if (schema.type === 'array') {
    return (
      <div className="space-y-1.5">
        <Label>
          {label}
          {isRequired && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {schema.description && <p className="text-xs text-muted-foreground">{schema.description}</p>}
        <ArrayField
          fieldKey={fieldKey}
          schema={schema}
          value={value}
          error={error}
          required={isRequired}
          onChange={onChange}
        />
      </div>
    );
  }

  // Nested object
  if (schema.type === 'object') {
    return (
      <ObjectField
        fieldKey={fieldKey}
        schema={schema}
        value={value}
        required={isRequired}
        onChange={onChange}
      />
    );
  }

  // Boolean toggle
  if (schema.type === 'boolean') {
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label>
            {label}
            {isRequired && <span className="ml-0.5 text-destructive">*</span>}
          </Label>
          {schema.description && <p className="text-xs text-muted-foreground">{schema.description}</p>}
        </div>
        <Switch
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(fieldKey, checked)}
        />
      </div>
    );
  }

  // Enum → Select
  if (schema.enum && schema.enum.length > 0) {
    return (
      <div className="space-y-1.5">
        <Label>
          {label}
          {isRequired && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {schema.description && <p className="text-xs text-muted-foreground">{schema.description}</p>}
        <Select value={(value as string) ?? ''} onValueChange={(v) => onChange(fieldKey, v)}>
          <SelectTrigger className={error ? 'border-destructive' : ''}>
            <SelectValue placeholder={`Select ${label}`} />
          </SelectTrigger>
          <SelectContent>
            {schema.enum.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // Number / integer
  if (schema.type === 'number' || schema.type === 'integer') {
    return (
      <div className="space-y-1.5">
        <Label>
          {label}
          {isRequired && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {schema.description && <p className="text-xs text-muted-foreground">{schema.description}</p>}
        <Input
          type="number"
          value={(value as string | number) ?? ''}
          min={schema.minimum}
          max={schema.maximum}
          step={schema.type === 'integer' ? 1 : 'any'}
          onChange={(e) => onChange(fieldKey, e.target.value === '' ? '' : Number(e.target.value))}
          className={error ? 'border-destructive' : ''}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // Textarea (format: textarea)
  if (schema.format === 'textarea') {
    return (
      <div className="space-y-1.5">
        <Label>
          {label}
          {isRequired && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {schema.description && <p className="text-xs text-muted-foreground">{schema.description}</p>}
        <Textarea
          value={(value as string) ?? ''}
          rows={4}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className={error ? 'border-destructive' : ''}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // Default: text / password input
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {isRequired && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {schema.description && <p className="text-xs text-muted-foreground">{schema.description}</p>}
      <Input
        type={schema.format === 'password' ? 'password' : 'text'}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        className={error ? 'border-destructive' : ''}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface PluginConfigFormProps {
  pluginId: string;
  pluginName: string;
  configSchema: JsonSchema;
  /** Existing saved config values (loaded before opening) */
  initialValues?: Record<string, unknown>;
  open: boolean;
  onClose: () => void;
  /** Called after a successful save */
  onSaved?: () => void;
}

export function PluginConfigForm({
  pluginId,
  pluginName,
  configSchema,
  initialValues,
  open,
  onClose,
  onSaved,
}: PluginConfigFormProps) {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    initialValues ?? buildDefaults(configSchema),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load existing config when dialog opens
  useEffect(() => {
    if (!open) return;
    if (initialValues) {
      setValues({ ...buildDefaults(configSchema), ...initialValues });
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    api
      .get<Record<string, unknown>>(`/api/v1/plugins/${pluginId}/config`)
      .then((data) => {
        if (cancelled) return;
        setValues({ ...buildDefaults(configSchema), ...data });
      })
      .catch(() => {
        if (cancelled) return;
        setValues(buildDefaults(configSchema));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, pluginId, configSchema, initialValues]);

  const handleChange = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateAll(configSchema, values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSaving(true);
    try {
      await api.put(`/api/v1/plugins/${pluginId}/config`, values);
      toast({ title: 'Configuration saved', description: `${pluginName} settings have been updated.` });
      onSaved?.();
      onClose();
    } catch {
      toast({
        title: 'Failed to save',
        description: 'Could not save plugin configuration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasFields = Object.keys(configSchema.properties ?? {}).length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <DialogTitle>Configure {pluginName}</DialogTitle>
          </div>
          {configSchema.description && (
            <DialogDescription>{configSchema.description}</DialogDescription>
          )}
        </DialogHeader>

        <Separator />

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasFields ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            This plugin has no configurable options.
          </div>
        ) : (
          <form id="plugin-config-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="space-y-5 py-4 px-1">
              {Object.entries(configSchema.properties ?? {}).map(([key, propSchema]) => (
                <SchemaField
                  key={key}
                  fieldKey={key}
                  schema={propSchema}
                  value={values[key]}
                  error={errors[key]}
                  required={(configSchema.required ?? []).includes(key)}
                  onChange={handleChange}
                />
              ))}
            </div>
          </form>
        )}

        <Separator />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          {hasFields && (
            <Button type="submit" form="plugin-config-form" disabled={isSaving || isLoading}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
