'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bot, Eye, EyeOff, Save, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Input, Label,
} from '@unicore/ui';
import { api } from '@/lib/api';

interface AiConfig {
  openaiKey: string;
  anthropicKey: string;
  defaultProvider: string;
  defaultModel: string;
  openaiAuthType: string;
  openaiBaseUrl: string;
  hasOpenaiKey: boolean;
  hasAnthropicKey: boolean;
}

const KNOWN_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o3-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-20250514'],
  ollama: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'phi3'],
};

export default function AiSettingsPage() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [defaultProvider, setDefaultProvider] = useState('openai');
  const [defaultModel, setDefaultModel] = useState('');
  const [openaiAuthType, setOpenaiAuthType] = useState('api-key');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('');
  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [liveModels, setLiveModels] = useState<string[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const data = await api.get<AiConfig>('/api/v1/settings/ai-config');
      setConfig(data);
      setOpenaiKey(data.openaiKey || '');
      setAnthropicKey(data.anthropicKey || '');
      setDefaultProvider(data.defaultProvider || 'openai');
      setDefaultModel(data.defaultModel || '');
      setOpenaiAuthType(data.openaiAuthType || 'api-key');
      setOpenaiBaseUrl(data.openaiBaseUrl || '');
    } catch {
      // not logged in or endpoint not available
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const data = await api.get<{ models?: string[] }>('/api/proxy/ai/llm/models');
      if (data.models?.length) {
        setLiveModels(data.models);
      }
    } catch {
      // AI Engine may not support /models endpoint — fall back to known list
      setLiveModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  // Auto-fetch models when provider changes or after save
  useEffect(() => {
    if (config?.hasOpenaiKey || config?.hasAnthropicKey) {
      fetchModels();
    }
  }, [config?.hasOpenaiKey, config?.hasAnthropicKey, fetchModels]);

  const models = liveModels.length > 0 ? liveModels : (KNOWN_MODELS[defaultProvider] ?? []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const body: Record<string, string> = { defaultProvider, defaultModel, openaiAuthType, openaiBaseUrl };
      if (openaiKey && !openaiKey.includes('••')) body.openaiKey = openaiKey;
      if (anthropicKey && !anthropicKey.includes('••')) body.anthropicKey = anthropicKey;

      const data = await api.put<AiConfig>('/api/v1/settings/ai-config', body);
      setConfig(data);
      setOpenaiKey(data.openaiKey || '');
      setAnthropicKey(data.anthropicKey || '');
      // Reload AI Engine providers with new keys
      try {
        await api.post('/api/proxy/ai/llm/reload');
      } catch {
        // AI Engine may not be reachable — keys will load on next restart
      }
      setStatus({ type: 'success', message: 'AI configuration saved and providers reloaded.' });
      fetchModels();
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save configuration' });
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
            <Label htmlFor="openai-auth">OpenAI Auth Type</Label>
            <div className="flex gap-2">
              <select
                id="openai-auth"
                value={openaiAuthType}
                onChange={(e) => setOpenaiAuthType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="api-key">API Key (platform.openai.com)</option>
                <option value="oauth">ChatGPT Subscription Token</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-10"
                onClick={() => window.open(
                  openaiAuthType === 'oauth'
                    ? 'https://chatgpt.com/api/auth/session'
                    : 'https://platform.openai.com/api-keys',
                  '_blank',
                )}
              >
                Get {openaiAuthType === 'oauth' ? 'Token' : 'Key'}
              </Button>
            </div>
            {openaiAuthType === 'oauth' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-800 dark:bg-blue-950">
                <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">How to get your ChatGPT access token:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-blue-700 dark:text-blue-300">
                  <li>Log in to <a href="https://chatgpt.com" target="_blank" rel="noreferrer" className="underline">chatgpt.com</a></li>
                  <li>Open <a href="https://chatgpt.com/api/auth/session" target="_blank" rel="noreferrer" className="underline">chatgpt.com/api/auth/session</a></li>
                  <li>Copy the <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">accessToken</code> value</li>
                  <li>Paste it below</li>
                </ol>
                <p className="mt-1.5 text-blue-600 dark:text-blue-400">Token refreshes every ~2 weeks. Requires active ChatGPT Plus/Pro/Team subscription.</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="openai-key">
              {openaiAuthType === 'oauth' ? 'ChatGPT Access Token' : 'OpenAI API Key'}
            </Label>
            <div className="flex gap-2">
              <Input
                id="openai-key"
                type={showOpenai ? 'text' : 'password'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={config?.hasOpenaiKey ? 'Key saved (enter new to replace)' : openaiAuthType === 'oauth' ? 'eyJhbGci...' : 'sk-...'}
                className="font-mono"
              />
              <Button variant="ghost" size="icon" onClick={() => setShowOpenai(!showOpenai)}>
                {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {openaiAuthType === 'oauth' && (
            <div className="space-y-2">
              <Label htmlFor="openai-base-url">ChatGPT API Base URL</Label>
              <Input
                id="openai-base-url"
                value={openaiBaseUrl}
                onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Default: api.openai.com/v1. Change if using a ChatGPT proxy (e.g. Azure OpenAI, local reverse proxy).
              </p>
            </div>
          )}

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
          <CardTitle>Model Selection</CardTitle>
          <CardDescription>Choose the default provider and model for AI agents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Default Provider</Label>
            <select
              id="provider"
              value={defaultProvider}
              onChange={(e) => { setDefaultProvider(e.target.value); setDefaultModel(''); }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">Ollama (local)</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="model">Default Model</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchModels}
                disabled={loadingModels}
                className="h-7 text-xs"
              >
                {loadingModels ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                Refresh models
              </Button>
            </div>
            <select
              id="model"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Auto (provider default)</option>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {liveModels.length > 0 && (
              <p className="text-xs text-muted-foreground">{liveModels.length} models available from AI Engine</p>
            )}
            {liveModels.length === 0 && models.length > 0 && (
              <p className="text-xs text-muted-foreground">Showing known models for {defaultProvider}</p>
            )}
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
