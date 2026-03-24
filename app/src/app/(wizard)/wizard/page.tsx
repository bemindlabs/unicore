'use client';

import { useEffect, useState } from 'react';
import { WizardProvider } from '@/hooks/use-wizard-state';
import { WizardContainer } from '@/components/wizard/wizard-container';

export default function WizardPage() {
  const [status, setStatus] = useState<'loading' | 'completed' | 'ready'>('loading');

  useEffect(() => {
    // Check server-side: if any users exist, wizard was already completed
    fetch('/auth/provision-admin', { method: 'HEAD' })
      .catch(() => {});

    // Check if users exist (health endpoint is public)
    fetch('/api/v1/admin/health')
      .then((r) => r.json())
      .then(() => {
        // If health works, check if users exist via a lightweight call
        // Use the settings API to check wizard_completed flag
        return fetch('/api/v1/settings/wizard-status')
          .then((r) => r.json())
          .then((data: any) => {
            if (data?.completed) {
              setStatus('completed');
            } else {
              // Fallback: check localStorage
              if (localStorage.getItem('wizard_completed') === 'true') {
                setStatus('completed');
              } else {
                setStatus('ready');
              }
            }
          })
          .catch(() => {
            // Settings API not available (no auth) — check localStorage
            if (localStorage.getItem('wizard_completed') === 'true') {
              setStatus('completed');
            } else {
              setStatus('ready');
            }
          });
      })
      .catch(() => {
        // API unreachable — check localStorage
        if (localStorage.getItem('wizard_completed') === 'true') {
          setStatus('completed');
        } else {
          setStatus('ready');
        }
      });
  }, []);

  if (status === 'loading') {
    return null;
  }

  if (status === 'completed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <h2 className="text-2xl font-bold">Setup Already Completed</h2>
        <p className="text-muted-foreground max-w-md">
          Your workspace has already been provisioned. You can sign in to access
          the dashboard.
        </p>
        <div className="flex gap-4">
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Login
          </a>
          <button
            onClick={() => {
              localStorage.removeItem('wizard_completed');
              setStatus('ready');
            }}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Re-run Wizard
          </button>
        </div>
      </div>
    );
  }

  return (
    <WizardProvider>
      <WizardContainer />
    </WizardProvider>
  );
}
