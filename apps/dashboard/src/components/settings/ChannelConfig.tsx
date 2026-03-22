'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CheckCircle2, Copy, Eye, EyeOff, Loader2, XCircle } from 'lucide-react';
import {
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
} from '@unicore/ui';

export interface ChannelField {
  key: string;
  label: string;
  placeholder?: string;
  /** If true, renders a password input with show/hide toggle */
  secret?: boolean;
}

export interface ChannelConfigProps {
  channelId: string;
  title: string;
  description: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  fields: ChannelField[];
  testConnection?: (values: Record<string, string>) => Promise<{ success: boolean; message: string }>;
  webhookPath?: string;
  /** Optional extra content rendered between the test result and the webhook URL */
  extraContent?: React.ReactNode;
  /** Hint text shown below the webhook URL */
  webhookHint?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function ChannelConfig({
  channelId,
  title,
  description,
  icon: Icon,
  fields,
  testConnection,
  webhookPath,
  extraContent,
  webhookHint = 'This URL is automatically registered as the webhook endpoint when you save.',
}: ChannelConfigProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, ''])),
  );
  const [enabled, setEnabled] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const webhookUrl = webhookPath ? `${API_URL}${webhookPath}` : null;

  // Load saved config on mount
  useEffect(() => {
    api
      .get<Record<string, unknown>>(`/api/v1/settings/${channelId}`)
      .then((data) => {
        if (data && typeof data === 'object') {
          const hasAnyField = fields.some((f) => data[f.key]);
          if (hasAnyField) {
            const loaded: Record<string, string> = {};
            for (const f of fields) {
              loaded[f.key] = String(data[f.key] ?? '');
            }
            setValues(loaded);
            setEnabled(Boolean(data.enabled));
            setIsConfigured(true);
          }
        }
      })
      .catch(() => {
        /* no saved config */
      });
  }, [channelId, fields]);

  const allFieldsFilled = fields.every((f) => values[f.key]?.trim());

  const handleFieldChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setIsConfigured(false);
  }, []);

  const toggleSecret = useCallback((key: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleTestConnection = useCallback(async () => {
    if (!testConnection) return;
    if (!allFieldsFilled) {
      toast({ title: 'Missing fields', description: 'Fill in all required fields first.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(values);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setIsTesting(false);
    }
  }, [testConnection, allFieldsFilled, values]);

  const handleSave = useCallback(async () => {
    if (!allFieldsFilled) {
      toast({ title: 'Missing fields', description: 'Fill in all required fields.' });
      return;
    }

    setIsSaving(true);
    try {
      await api.put(`/api/v1/settings/${channelId}`, {
        ...values,
        enabled,
      });

      setIsConfigured(true);
      toast({
        title: `${title} configured`,
        description: enabled
          ? `${title} is active and ready to receive messages.`
          : 'Configuration saved. Enable when ready.',
      });
    } catch (err) {
      toast({
        title: 'Failed to save',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [allFieldsFilled, channelId, values, enabled, title]);

  const copyWebhookUrl = useCallback(() => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: 'Copied', description: 'Webhook URL copied to clipboard.' });
  }, [webhookUrl]);

  // Determine which field gets the test button (last secret field, or last field)
  const testFieldKey = testConnection
    ? (fields.findLast((f) => f.secret)?.key ?? fields[fields.length - 1]?.key)
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{title}</CardTitle>
            {isConfigured ? (
              <Badge variant="secondary" className="text-xs">
                <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                <XCircle className="mr-1 h-3 w-3" />
                Not connected
              </Badge>
            )}
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {fields.map((field) => {
          const isTestField = field.key === testFieldKey;
          const isSecret = field.secret;
          const isVisible = visibleSecrets[field.key];
          const fieldId = `${channelId}-${field.key}`;

          return (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={fieldId}>{field.label}</Label>
              <div className={isTestField ? 'flex gap-2' : undefined}>
                <div className={`relative ${isTestField ? 'flex-1' : ''}`}>
                  <Input
                    id={fieldId}
                    type={isSecret && !isVisible ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    value={values[field.key] ?? ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  />
                  {isSecret && (
                    <button
                      type="button"
                      onClick={() => toggleSecret(field.key)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {isVisible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
                {isTestField && testConnection && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={isTesting || !allFieldsFilled}
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        Testing
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                )}
              </div>

              {isTestField && testResult && (
                <p
                  className={`text-xs ${
                    testResult.success ? 'text-emerald-600' : 'text-destructive'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="mr-1 inline h-3 w-3" />
                  ) : (
                    <XCircle className="mr-1 inline h-3 w-3" />
                  )}
                  {testResult.message}
                </p>
              )}
            </div>
          );
        })}

        {extraContent}

        {/* Webhook URL */}
        {webhookUrl && (
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-xs">
                {webhookUrl}
              </code>
              <Button variant="ghost" size="sm" onClick={copyWebhookUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{webhookHint}</p>
          </div>
        )}

        <Separator />

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || !allFieldsFilled}>
            {isSaving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Saving
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
