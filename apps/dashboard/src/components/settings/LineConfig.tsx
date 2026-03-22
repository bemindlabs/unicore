'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Copy, Eye, EyeOff, Loader2, MessageSquare, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
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

interface LineConfigState {
  channelId: string;
  channelSecret: string;
  channelAccessToken: string;
  enabled: boolean;
  webhookUrl: string;
  isConfigured: boolean;
}

interface LineBotInfo {
  displayName: string;
  pictureUrl?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function LineConfig() {
  const [config, setConfig] = useState<LineConfigState>({
    channelId: '',
    channelSecret: '',
    channelAccessToken: '',
    enabled: false,
    webhookUrl: `${API_URL}/webhooks/line`,
    isConfigured: false,
  });
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [botInfo, setBotInfo] = useState<LineBotInfo | null>(null);

  const handleTestConnection = useCallback(async () => {
    if (!config.channelAccessToken.trim()) {
      toast({ title: 'Missing token', description: 'Enter a Channel Access Token first.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setBotInfo(null);

    try {
      const response = await fetch('https://api.line.me/v2/bot/info', {
        headers: { Authorization: `Bearer ${config.channelAccessToken}` },
      });
      const data = await response.json();

      if (response.ok) {
        setBotInfo({ displayName: data.displayName, pictureUrl: data.pictureUrl });
        setTestResult({
          success: true,
          message: `Connected to ${data.displayName}`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.message ?? 'Invalid Channel Access Token',
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setIsTesting(false);
    }
  }, [config.channelAccessToken]);

  const handleSave = useCallback(async () => {
    if (!config.channelId.trim() || !config.channelSecret.trim() || !config.channelAccessToken.trim()) {
      toast({ title: 'Missing fields', description: 'Fill in all LINE credential fields.' });
      return;
    }

    setIsSaving(true);
    try {
      await api.put('/api/v1/settings/line', {
        channelId: config.channelId,
        channelSecret: config.channelSecret,
        channelAccessToken: config.channelAccessToken,
        enabled: config.enabled,
      });

      setConfig((prev) => ({ ...prev, isConfigured: true }));
      toast({
        title: 'LINE configured',
        description: config.enabled
          ? 'LINE bot is active and ready to receive messages.'
          : 'Configuration saved. Enable the bot when ready.',
      });
    } catch (err) {
      toast({
        title: 'Failed to save',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [config.channelId, config.channelSecret, config.channelAccessToken, config.enabled]);

  const copyWebhookUrl = useCallback(() => {
    navigator.clipboard.writeText(config.webhookUrl);
    toast({ title: 'Copied', description: 'Webhook URL copied to clipboard.' });
  }, [config.webhookUrl]);

  const hasAllFields =
    config.channelId.trim() && config.channelSecret.trim() && config.channelAccessToken.trim();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">LINE Messaging</CardTitle>
            {config.isConfigured ? (
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
            checked={config.enabled}
            onCheckedChange={(enabled) => setConfig((prev) => ({ ...prev, enabled }))}
          />
        </div>
        <CardDescription>
          Connect a LINE Official Account for messaging, notifications, and workflow actions.
          Get your credentials from the{' '}
          <a
            href="https://developers.line.biz/console/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            LINE Developers Console
          </a>
          .
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Channel ID */}
        <div className="space-y-2">
          <Label htmlFor="line-channel-id">Channel ID</Label>
          <Input
            id="line-channel-id"
            type="text"
            placeholder="1234567890"
            value={config.channelId}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, channelId: e.target.value, isConfigured: false }))
            }
          />
        </div>

        {/* Channel Secret */}
        <div className="space-y-2">
          <Label htmlFor="line-channel-secret">Channel Secret</Label>
          <div className="relative">
            <Input
              id="line-channel-secret"
              type={showSecret ? 'text' : 'password'}
              placeholder="Your channel secret"
              value={config.channelSecret}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, channelSecret: e.target.value, isConfigured: false }))
              }
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Channel Access Token */}
        <div className="space-y-2">
          <Label htmlFor="line-channel-access-token">Channel Access Token</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="line-channel-access-token"
                type={showToken ? 'text' : 'password'}
                placeholder="Your channel access token"
                value={config.channelAccessToken}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    channelAccessToken: e.target.value,
                    isConfigured: false,
                  }))
                }
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTesting || !config.channelAccessToken.trim()}
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
          </div>

          {testResult && (
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

        {/* Bot Info */}
        {botInfo && (
          <div className="flex items-center gap-3 rounded-lg border p-3">
            {botInfo.pictureUrl && (
              <img
                src={botInfo.pictureUrl}
                alt={botInfo.displayName}
                className="h-10 w-10 rounded-full"
              />
            )}
            <div>
              <p className="text-sm font-medium">{botInfo.displayName}</p>
              <p className="text-xs text-muted-foreground">LINE Official Account</p>
            </div>
          </div>
        )}

        {/* Webhook URL */}
        <div className="space-y-2">
          <Label>Webhook URL</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs">
              {config.webhookUrl}
            </code>
            <Button variant="ghost" size="sm" onClick={copyWebhookUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Set this URL as the Webhook URL in the LINE Developers Console.
          </p>
        </div>

        <Separator />

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || !hasAllFields}>
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
