"use client";

import { useState, useEffect, useCallback } from "react";
import type { BackofficeAgent } from "@/lib/backoffice/types";
import {
  getAgents,
  addAgent,
  updateAgent,
  deleteAgent,
} from "@/lib/backoffice/store";
import { BackofficeApp } from "@/components/backoffice/BackofficeApp";

export default function BackofficePage() {
  const [agents, setAgents] = useState<BackofficeAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  const fetchAgents = useCallback(async () => {
    const { agents: data, cached } = await getAgents();
    setAgents(data);
    setApiError(cached);
  }, []);

  useEffect(() => {
    fetchAgents().finally(() => setLoading(false));
  }, [fetchAgents]);

  // Poll every 10s for live status updates
  useEffect(() => {
    const id = setInterval(fetchAgents, 10_000);
    return () => clearInterval(id);
  }, [fetchAgents]);

  if (loading) {
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
      apiError={apiError}
      onUpdateAgent={async (agent) => setAgents(await updateAgent(agent))}
      onAddAgent={async (agent) => setAgents(await addAgent(agent))}
      onDeleteAgent={async (id) => setAgents(await deleteAgent(id))}
    />
  );
}
