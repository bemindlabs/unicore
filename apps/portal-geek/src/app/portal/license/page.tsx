'use client';

import { useState } from 'react';
import {
  KeyRound,
  Shield,
  CheckCircle2,
  XCircle,
  Monitor,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';

// Mock license data
const license = {
  key: 'UC-G7X2-M4KN-P9QR-L5TW',
  edition: 'pro',
  status: 'active',
  expiresAt: '2027-03-20',
  activatedAt: '2026-03-20',
  machines: [
    { id: 'mac-001', name: 'MacBook Pro M3', fingerprint: 'sha256:a3b9c1...', lastSeen: '2026-03-24', active: true },
    { id: 'srv-001', name: 'Dev Server', fingerprint: 'sha256:f7e2d8...', lastSeen: '2026-03-22', active: true },
  ],
  maxMachines: 3,
  features: {
    geekCli: true,
    allAgents: true,
    customAgentBuilder: true,
    fullRbac: true,
    advancedWorkflows: true,
    allChannels: true,
    unlimitedRag: true,
    whiteLabelBranding: true,
    sso: true,
    auditLogs: true,
    prioritySupport: true,
    aiDlc: false,
    multiTenancy: false,
    compliance: false,
    haCluster: false,
    enterpriseSso: false,
    customApi: false,
  },
};

const featureLabels: Record<string, string> = {
  geekCli: 'Geek CLI',
  allAgents: 'All Agents',
  customAgentBuilder: 'Agent Builder',
  fullRbac: 'Full RBAC',
  advancedWorkflows: 'Advanced Workflows',
  allChannels: 'All Channels',
  unlimitedRag: 'Unlimited RAG',
  whiteLabelBranding: 'White Label',
  sso: 'SSO',
  auditLogs: 'Audit Logs',
  prioritySupport: 'Priority Support',
  aiDlc: 'AI-DLC',
  multiTenancy: 'Multi-Tenancy',
  compliance: 'Compliance',
  haCluster: 'HA Cluster',
  enterpriseSso: 'Enterprise SSO',
  customApi: 'Custom API',
};

export default function LicensePage() {
  const [copied, setCopied] = useState(false);

  function copyKey() {
    navigator.clipboard.writeText(license.key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const enabledFeatures = Object.entries(license.features).filter(([, v]) => v);
  const disabledFeatures = Object.entries(license.features).filter(([, v]) => !v);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <KeyRound className="h-6 w-6 text-green-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-50">License</h1>
          <p className="text-sm text-zinc-400">Manage your license key and feature flags.</p>
        </div>
      </div>

      {/* License info */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
            <Shield className="h-4 w-4 text-green-500" />
            License Details
          </h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            license.status === 'active'
              ? 'bg-green-950/50 border border-green-800 text-green-400'
              : 'bg-red-950/50 border border-red-800 text-red-400'
          }`}>
            {license.status}
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
            <span className="text-xs text-zinc-500 w-16 shrink-0">Key</span>
            <code className="flex-1 font-mono text-sm text-zinc-50 tracking-wide">{license.key}</code>
            <button onClick={copyKey} className="shrink-0 text-zinc-500 hover:text-zinc-50 transition-colors">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs text-zinc-500">Edition</p>
              <p className="text-sm font-medium text-zinc-50 capitalize">{license.edition}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs text-zinc-500">Activated</p>
              <p className="text-sm font-medium text-zinc-50">{license.activatedAt}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs text-zinc-500">Expires</p>
              <p className="text-sm font-medium text-zinc-50">{license.expiresAt}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Machine bindings */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
            <Monitor className="h-4 w-4 text-zinc-400" />
            Machine Bindings
          </h2>
          <span className="text-xs text-zinc-500">
            {license.machines.length} / {license.maxMachines} slots used
          </span>
        </div>
        <div className="space-y-2">
          {license.machines.map((machine) => (
            <div key={machine.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-50">{machine.name}</p>
                <p className="text-xs text-zinc-500 font-mono">{machine.fingerprint}</p>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-1 text-xs ${
                  machine.active ? 'text-green-400' : 'text-zinc-500'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${machine.active ? 'bg-green-500' : 'bg-zinc-600'}`} />
                  {machine.active ? 'Active' : 'Inactive'}
                </span>
                <p className="text-[10px] text-zinc-600">Last seen: {machine.lastSeen}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature flags */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-semibold text-zinc-50 mb-4">Feature Flags</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {enabledFeatures.map(([key]) => (
            <div key={key} className="flex items-center gap-2 rounded-lg border border-green-800/30 bg-green-950/10 px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              <span className="text-xs text-zinc-50">{featureLabels[key] || key}</span>
            </div>
          ))}
          {disabledFeatures.map(([key]) => (
            <div key={key} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
              <XCircle className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
              <span className="text-xs text-zinc-500">{featureLabels[key] || key}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
