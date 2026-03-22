'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Bot, CheckCircle2, Copy, Eye, EyeOff, Loader2, XCircle } from 'lucide-react';
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

interface TelegramConfigState {
  botToken: string;
  enabled: boolean;
  botUsername: string | null;
  webhookUrl: string;
  isConfigured: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function TelegramConfig() {
  const [config, setConfig] = useState<TelegramConfigState>({
    botToken: '',
    enabled: false,
    botUsername: null,
    webhookUrl: `${API_URL}/webhooks/telegram`,
    isConfigured: false,
  });
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = useCallback(async () => {
    if (!config.botToken.trim()) {
      toast({ title: 'Missing token', description: 'Enter a bot token first.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${config.botToken}/getMe`,
      );
      const data = await response.json();

      if (data.ok) {
        setTestResult({
          success: true,
          message: `Connected to @${data.result.username}`,
        });
        setConfig((prev) => ({
          ...prev,
          botUsername: `@${data.result.username}`,
        }));
      } else {
        setTestResult({
          success: false,
          message: data.description ?? 'Invalid bot token',
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
  }, [config.botToken]);

  const handleSave = useCallback(async () => {
    if (!config.botToken.trim()) {
      toast({ title: 'Missing token', description: 'Enter a bot token first.' });
      return;
    }

    setIsSaving(true);
    try {
      await api.put('/api/v1/settings/telegram', {
        botToken: config.botToken,
        enabled: config.enabled,
      });

      setConfig((prev) => ({ ...prev, isConfigured: true }));
      toast({
        title: 'Telegram Bot configured',
        description: config.enabled
          ? 'Bot is active and ready to receive messages.'
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
  }, [config.botToken, config.enabled]);

  const copyWebhookUrl = useCallback(() => {
    navigator.clipboard.writeText(config.webhookUrl);
    toast({ title: 'Copied', description: 'Webhook URL copied to clipboard.' });
  }, [config.webhookUrl]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Telegram Bot</CardTitle>
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
          Connect a Telegram Bot for messaging, notifications, and workflow actions.
          Create a bot via{' '}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            @BotFather
          </a>{' '}
          to get your token.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Bot Token */}
        <div className="space-y-2">
          <Label htmlFor="telegram-bot-token">Bot Token</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="telegram-bot-token"
                type={showToken ? 'text' : 'password'}
                placeholder="123456789:ABCdefGhIjKlMnOpQrStUvWxYz"
                value={config.botToken}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    botToken: e.target.value,
                    botUsername: null,
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
              disabled={isTesting || !config.botToken.trim()}
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

        {/* Bot Username */}
        {config.botUsername && (
          <div className="space-y-2">
            <Label>Bot Username</Label>
            <p className="text-sm text-muted-foreground">{config.botUsername}</p>
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
            This URL is automatically registered as the webhook endpoint when you save.
          </p>
        </div>

        <Separator />

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || !config.botToken.trim()}>
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
