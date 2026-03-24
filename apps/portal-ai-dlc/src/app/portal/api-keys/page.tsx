'use client';

import { useState } from 'react';
import { Settings, Plus, Copy, Check, Eye, EyeOff, Trash2, Shield } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
  permissions: string[];
}

const initialKeys: ApiKey[] = [
  {
    id: 'key-1',
    name: 'Production',
    key: 'dlc_sk_prod_7x2m4kn9qrl5twb3',
    created: '2026-03-10',
    lastUsed: '2026-03-24',
    permissions: ['chat', 'rooms', 'agents'],
  },
  {
    id: 'key-2',
    name: 'Development',
    key: 'dlc_sk_dev_p8f3g6j2nvh4czd9',
    created: '2026-03-15',
    lastUsed: '2026-03-23',
    permissions: ['chat', 'rooms'],
  },
];

const modelConfig = {
  provider: 'Anthropic',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.7,
  ragEnabled: true,
  ragScope: 'central',
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  function toggleVisibility(id: string) {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function copyKey(key: string, id: string) {
    navigator.clipboard.writeText(key).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function maskKey(key: string) {
    return key.slice(0, 10) + '...' + key.slice(-4);
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-blue-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-50">API Keys & Configuration</h1>
          <p className="text-sm text-zinc-400">Manage API keys and model settings for DLC agents.</p>
        </div>
      </div>

      {/* API Keys */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
            <Shield className="h-4 w-4 text-blue-500" />
            API Keys
          </h2>
          <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            New Key
          </button>
        </div>
        <div className="space-y-2">
          {keys.map((apiKey) => (
            <div key={apiKey.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-zinc-50">{apiKey.name}</p>
                  <p className="text-[10px] text-zinc-600">Created: {apiKey.created} &middot; Last used: {apiKey.lastUsed}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleVisibility(apiKey.id)} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-50">
                    {visibleKeys[apiKey.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => copyKey(apiKey.key, apiKey.id)} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-50">
                    {copied === apiKey.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button className="rounded p-1.5 text-zinc-500 hover:bg-red-950 hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <code className="block rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-400">
                {visibleKeys[apiKey.id] ? apiKey.key : maskKey(apiKey.key)}
              </code>
              <div className="flex gap-1.5 mt-2">
                {apiKey.permissions.map((p) => (
                  <span key={p} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model Configuration */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-semibold text-zinc-50 mb-4">Model Configuration</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-500">Provider</p>
            <p className="text-sm font-medium text-zinc-50">{modelConfig.provider}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-500">Model</p>
            <p className="text-sm font-medium text-zinc-50 font-mono text-[11px]">{modelConfig.model}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-500">Max Tokens</p>
            <p className="text-sm font-medium text-zinc-50">{modelConfig.maxTokens.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-500">Temperature</p>
            <p className="text-sm font-medium text-zinc-50">{modelConfig.temperature}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-500">RAG</p>
            <p className="text-sm font-medium text-green-400">{modelConfig.ragEnabled ? 'Enabled' : 'Disabled'}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-500">RAG Scope</p>
            <p className="text-sm font-medium text-zinc-50 capitalize">{modelConfig.ragScope}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
