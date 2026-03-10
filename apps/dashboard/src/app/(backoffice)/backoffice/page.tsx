'use client';

import { useState, useEffect } from 'react';
import type { BackofficeAgent } from '@/lib/backoffice/types';
import { getAgents, addAgent, updateAgent, deleteAgent } from '@/lib/backoffice/store';
import { BackofficeApp } from '@/components/backoffice/BackofficeApp';

export default function BackofficePage() {
  const [agents, setAgents] = useState<BackofficeAgent[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setAgents(getAgents());
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060a14]">
        <div className="font-mono text-xs text-cyan-500 animate-pulse">
          LOADING SYSTEMS...
        </div>
      </div>
    );
  }

  return (
    <BackofficeApp
      agents={agents}
      onUpdateAgent={(agent) => setAgents(updateAgent(agent))}
      onAddAgent={(agent) => setAgents(addAgent(agent))}
      onDeleteAgent={(id) => setAgents(deleteAgent(id))}
    />
  );
}
