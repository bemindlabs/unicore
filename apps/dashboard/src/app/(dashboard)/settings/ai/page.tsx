'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bot, Eye, EyeOff, Save, CheckCircle, AlertCircle, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Input, Label,
} from '@unicore/ui';
import { api } from '@/lib/api';

// ── Provider definitions ──────────────────────────────────────────────────

interface ProviderDef {
  id: string;
  name: string;
  keyField: string;
  getKeyUrl: string;
  models: string[];
  description?: string;
}

const PROVIDERS: ProviderDef[] = [
  { id: 'openai',     name: 'OpenAI',              keyField: 'openaiKey',     getKeyUrl: 'https://platform.openai.com/api-keys',          models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o4-mini'] },
  { id: 'anthropic',  name: 'Anthropic',           keyField: 'anthropicKey',  getKeyUrl: 'https://console.anthropic.com/settings/keys',   models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001'] },
  { id: 'deepseek',   name: 'DeepSeek',            keyField: 'deepseekKey',   getKeyUrl: 'https://platform.deepseek.com/api_keys',        models: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'groq',       name: 'Groq',                keyField: 'groqKey',       getKeyUrl: 'https://console.groq.com/keys',                 models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'], description: 'Ultra-fast inference' },
  { id: 'gemini',     name: 'Google Gemini',        keyField: 'geminiKey',     getKeyUrl: 'https://aistudio.google.com/apikey',             models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'] },
  { id: 'moonshot',   name: 'Moonshot AI / Kimi',   keyField: 'moonshotKey',   getKeyUrl: 'https://platform.moonshot.cn/console/api-keys',  models: ['kimi-k2', 'moonshot-v1-128k', 'moonshot-v1-32k'] },
  { id: 'mistral',    name: 'Mistral AI',           keyField: 'mistralKey',    getKeyUrl: 'https://console.mistral.ai/api-keys/',           models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'] },
  { id: 'xai',        name: 'xAI (Grok)',           keyField: 'xaiKey',        getKeyUrl: 'https://console.x.ai/',                         models: ['grok-3', 'grok-3-mini', 'grok-3-fast'] },
  { id: 'openrouter', name: 'OpenRouter',           keyField: 'openrouterKey', getKeyUrl: 'https://openrouter.ai/keys',                    models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4-20250514', 'google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct'], description: '200+ models, free tier' },
  { id: 'together',   name: 'Together AI',          keyField: 'togetherKey',   getKeyUrl: 'https://api.together.xyz/settings/api-keys',     models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'] },
  { id: 'fireworks',  name: 'Fireworks AI',         keyField: 'fireworksKey',  getKeyUrl: 'https://fireworks.ai/api-keys',                  models: ['accounts/fireworks/models/llama-v3p1-70b-instruct'] },
  { id: 'cohere',     name: 'Cohere',               keyField: 'cohereKey',     getKeyUrl: 'https://dashboard.cohere.com/api-keys',          models: ['command-r-plus', 'command-r', 'command-light'] },
  { id: 'ollama',     name: 'Ollama (local)',        keyField: '',              getKeyUrl: '',                                              models: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'phi3'], description: 'Free, runs locally' },
];

// ── Page ──────────────────────────────────────────────────────────────────

export default function AiSettingsPage() {
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [defaultProvider, setDefaultProvider] = useState('openai');
  const [defaultModel, setDefaultModel] = useState('');
  const [openaiAuthType, setOpenaiAuthType] = useState('api-key');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [liveModels, setLiveModels] = useState<string[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const data = await api.get<Record<string, any>>('/api/v1/settings/ai-config');
      setConfig(data);
      const newKeys: Record<string, string> = {};
      for (const p of PROVIDERS) {
        if (p.keyField) newKeys[p.keyField] = data[p.keyField] || '';
      }
      setKeys(newKeys);
      setDefaultProvider(data.defaultProvider || 'openai');
      setDefaultModel(data.defaultModel || '');
      setOpenaiAuthType(data.openaiAuthType || 'api-key');
      setOpenaiBaseUrl(data.openaiBaseUrl || '');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const data = await api.get<{ models?: string[] }>('/api/proxy/ai/llm/models');
      if (data.models?.length) setLiveModels(data.models);
    } catch { setLiveModels([]); }
    finally { setLoadingModels(false); }
  }, []);

  const activeProvider = PROVIDERS.find((p) => p.id === defaultProvider);
  const models = liveModels.length > 0 ? liveModels : (activeProvider?.models ?? []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const body: Record<string, string> = { defaultProvider, defaultModel, openaiAuthType, openaiBaseUrl };
      for (const [field, value] of Object.entries(keys)) {
        if (value && !value.includes('••')) body[field] = value;
      }
      const data = await api.put<Record<string, any>>('/api/v1/settings/ai-config', body);
      setConfig(data);
      const newKeys: Record<string, string> = {};
      for (const p of PROVIDERS) {
        if (p.keyField) newKeys[p.keyField] = data[p.keyField] || '';
      }
      setKeys(newKeys);
      try { await api.post('/api/proxy/ai/llm/reload'); } catch { /* ignore */ }
      setStatus({ type: 'success', message: 'AI configuration saved and providers reloaded.' });
      fetchModels();
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save' });
    } finally { setSaving(false); }
  };

  const configuredCount = PROVIDERS.filter((p) => p.keyField && config?.[`has${p.keyField[0].toUpperCase()}${p.keyField.slice(1)}`]).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">AI Configuration</h1>
          <p className="text-muted-foreground">{configuredCount} provider{configuredCount !== 1 ? 's' : ''} configured &middot; {PROVIDERS.length - 1} available</p>
        </div>
      </div>

      {status && (
        <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${status.type === 'success' ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'}`}>
          {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {status.message}
        </div>
      )}

      {/* Default Provider + Model */}
      <Card>
        <CardHeader>
          <CardTitle>Default Provider</CardTitle>
          <CardDescription>Choose which provider agents use by default. Others are used as failover.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <select
              id="provider"
              value={defaultProvider}
              onChange={(e) => { setDefaultProvider(e.target.value); setDefaultModel(''); }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.description ? ` — ${p.description}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="model">Model</Label>
              <Button variant="ghost" size="sm" onClick={fetchModels} disabled={loadingModels} className="h-7 text-xs">
                {loadingModels ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                Refresh
              </Button>
            </div>
            <select
              id="model"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Auto (provider default)</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* OpenAI Auth Type (special case) */}
      {defaultProvider === 'openai' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">OpenAI Auth</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <select
                value={openaiAuthType}
                onChange={(e) => setOpenaiAuthType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="api-key">API Key</option>
                <option value="oauth">ChatGPT Subscription Token</option>
              </select>
              <Button variant="outline" size="sm" className="shrink-0 h-9" onClick={() => window.open(openaiAuthType === 'oauth' ? 'https://chatgpt.com/api/auth/session' : 'https://platform.openai.com/api-keys', '_blank')}>
                Get {openaiAuthType === 'oauth' ? 'Token' : 'Key'}
              </Button>
            </div>
            {openaiAuthType === 'oauth' && (
              <>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs dark:border-blue-800 dark:bg-blue-950">
                  <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">Get ChatGPT token:</p>
                  <ol className="list-decimal list-inside text-blue-700 dark:text-blue-300 space-y-0.5">
                    <li>Log in to <a href="https://chatgpt.com" target="_blank" rel="noreferrer" className="underline">chatgpt.com</a></li>
                    <li>Open <a href="https://chatgpt.com/api/auth/session" target="_blank" rel="noreferrer" className="underline">chatgpt.com/api/auth/session</a></li>
                    <li>Copy <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">accessToken</code></li>
                  </ol>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Proxy URL (optional)</Label>
                  <Input value={openaiBaseUrl} onChange={(e) => setOpenaiBaseUrl(e.target.value)} placeholder="Auto (built-in proxy)" className="font-mono text-xs h-8" />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* API Keys — all providers */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Keys are encrypted (AES-256-GCM) before storage. Configure one or more providers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {PROVIDERS.filter((p) => p.keyField).map((p) => {
            const hasKey = config?.[`has${p.keyField[0].toUpperCase()}${p.keyField.slice(1)}`];
            return (
              <div key={p.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={p.keyField} className="text-sm flex items-center gap-2">
                    {p.name}
                    {hasKey && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" title="Configured" />}
                    {p.description && <span className="text-[10px] text-muted-foreground font-normal">({p.description})</span>}
                  </Label>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1" onClick={() => window.open(p.getKeyUrl, '_blank')}>
                    Get Key <ExternalLink className="h-2.5 w-2.5" />
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  <Input
                    id={p.keyField}
                    type={showKeys[p.keyField] ? 'text' : 'password'}
                    value={keys[p.keyField] || ''}
                    onChange={(e) => setKeys((prev) => ({ ...prev, [p.keyField]: e.target.value }))}
                    placeholder={hasKey ? 'Saved (enter new to replace)' : 'sk-...'}
                    className="font-mono text-xs h-9"
                  />
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowKeys((prev) => ({ ...prev, [p.keyField]: !prev[p.keyField] }))}>
                    {showKeys[p.keyField] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            );
          })}
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
