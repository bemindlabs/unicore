'use client';

import { useEffect, useRef } from 'react';
import { X, Check, Minus, Crown, MessageSquare } from 'lucide-react';
import { Button } from '@bemindlabs/unicore-ui';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FEATURES = [
  { label: 'AI Agents', community: '2 agents', pro: '50 agents', enterprise: 'Unlimited' },
  { label: 'Messaging Channels', community: false, pro: true, enterprise: true },
  { label: 'Single Sign-On (SSO)', community: false, pro: true, enterprise: true },
  { label: 'Role-Based Access (RBAC)', community: '3 roles', pro: '20 roles', enterprise: 'Unlimited' },
  { label: 'Custom Domains', community: false, pro: true, enterprise: true },
  { label: 'White-Label Branding', community: false, pro: true, enterprise: true },
  { label: 'Advanced Workflows', community: false, pro: true, enterprise: true },
  { label: 'Audit Logs', community: false, pro: true, enterprise: true },
  { label: 'Multi-Tenancy', community: false, pro: false, enterprise: true },
  { label: 'SLA Support', community: 'Community', pro: 'Priority Email', enterprise: 'Dedicated CSM' },
] as const;

type CellValue = boolean | string;

function Cell({ value }: { value: CellValue }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-green-500" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />;
  return <span className="text-xs text-center">{value}</span>;
}

export function FeatureComparisonModal({ open, onOpenChange }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onOpenChange(false); }}
    >
      <div className="relative w-full max-w-2xl rounded-xl border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Compare Plans</h2>
            <p className="text-sm text-muted-foreground">Choose the plan that fits your team</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="w-1/2 pb-3 text-left font-medium text-muted-foreground">Feature</th>
                <th className="w-[16.67%] pb-3 text-center font-semibold">Community</th>
                <th className="w-[16.67%] pb-3 text-center font-semibold text-blue-600 dark:text-blue-400">
                  Pro
                </th>
                <th className="w-[16.67%] pb-3 text-center font-semibold text-purple-600 dark:text-purple-400">
                  Enterprise
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {FEATURES.map((f) => (
                <tr key={f.label} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 pr-4 text-left">{f.label}</td>
                  <td className="py-2.5 text-center">
                    <Cell value={f.community} />
                  </td>
                  <td className="py-2.5 text-center">
                    <Cell value={f.pro} />
                  </td>
                  <td className="py-2.5 text-center">
                    <Cell value={f.enterprise} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            All plans include unlimited messages and API access.
          </p>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                window.open('https://unicore.bemind.tech/#pricing', '_blank', 'noopener,noreferrer');
              }}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Contact Sales
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                window.open('https://unicore.bemind.tech/get-started', '_blank', 'noopener,noreferrer');
              }}
            >
              <Crown className="h-3.5 w-3.5" />
              Start Free Trial
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
