'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bot, Eye, EyeOff, Save, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Input, Label,
} from '@unicore/ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface AiConfig {
  openaiKey: string;
  anthropicKey: string;
  defaultProvider: string;
  defaultModel: string;
  hasOpenaiKey: boolean;
  hasAnthropicKey: boolean;
}

export default function AiSettingsPage() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [defaultProvider, setDefaultProvider] = useState('openai');
  const [defaultModel, setDefaultModel] = useState('');
  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/settings/ai-config`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setOpenaiKey(data.openaiKey || '');
        setAnthropicKey(data.anthropicKey || '');
        setDefaultProvider(data.defaultProvider || 'openai');
        setDefaultModel(data.defaultModel || '');
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const body: Record<string, string> = { defaultProvider, defaultModel };
      if (openaiKey && !openaiKey.includes('••')) body.openaiKey = openaiKey;
      if (anthropicKey && !anthropicKey.includes('••')) body.anthropicKey = anthropicKey;

      const res = await fetch(`${API}/api/v1/settings/ai-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setOpenaiKey(data.openaiKey || '');
        setAnthropicKey(data.anthropicKey || '');
        setStatus({ type: 'success', message: 'AI configuration saved. Restart AI Engine to apply new keys.' });
      } else {
        setStatus({ type: 'error', message: 'Failed to save configuration' });
      }
    } catch {
      setStatus({ type: 'error', message: 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">AI Configuration</h1>
          <p className="text-muted-foreground">Manage LLM provider API keys and model preferences</p>
        </div>
      </div>

      {status && (
        <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${status.type === 'success' ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'}`}>
          {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {status.message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Keys are encrypted (AES-256-GCM) before storage. Only masked values are returned to the browser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai-key">OpenAI API Key</Label>
            <div className="flex gap-2">
              <Input
                id="openai-key"
                type={showOpenai ? 'text' : 'password'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={config?.hasOpenaiKey ? 'Key saved (enter new to replace)' : 'sk-...'}
                className="font-mono"
              />
              <Button variant="ghost" size="icon" onClick={() => setShowOpenai(!showOpenai)}>
                {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="anthropic-key">Anthropic API Key</Label>
            <div className="flex gap-2">
              <Input
                id="anthropic-key"
                type={showAnthropic ? 'text' : 'password'}
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder={config?.hasAnthropicKey ? 'Key saved (enter new to replace)' : 'sk-ant-...'}
                className="font-mono"
              />
              <Button variant="ghost" size="icon" onClick={() => setShowAnthropic(!showAnthropic)}>
                {showAnthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Defaults</CardTitle>
          <CardDescription>Choose which provider and model to use by default</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Default Provider</Label>
            <select
              id="provider"
              value={defaultProvider}
              onChange={(e) => setDefaultProvider(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">Ollama (local)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Default Model (optional)</Label>
            <Input
              id="model"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              placeholder="e.g. gpt-4o, claude-sonnet-4-20250514"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
