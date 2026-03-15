"use client";

import { useState } from "react";
import type { BackofficeAgent } from "@/lib/backoffice/types";
import { Header } from "./Header";
import { TeamSidebar } from "./TeamSidebar";
import { OfficeFloor } from "./OfficeFloor";
import { WorkstationGrid } from "./WorkstationGrid";
import { AgentModal } from "./AgentModal";

interface Props {
  agents: BackofficeAgent[];
  apiError?: boolean;
  onUpdateAgent: (agent: BackofficeAgent) => Promise<void>;
  onAddAgent: (agent: BackofficeAgent) => Promise<void>;
  onDeleteAgent: (id: string) => Promise<void>;
}

export function BackofficeApp({
  agents,
  apiError,
  onUpdateAgent,
  onAddAgent,
  onDeleteAgent,
}: Props) {
  const [selectedAgent, setSelectedAgent] = useState<BackofficeAgent | null>(
    null,
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState<
    "all" | "working" | "idle"
  >("all");

  const filteredAgents =
    sidebarFilter === "all"
      ? agents
      : agents.filter((a) => a.status === sidebarFilter);

  const conferenceAgents = agents.filter((a) => a.room === "conference");
  const mainOfficeAgents = agents.filter((a) => a.room === "main-office");
  const standaloneAgents = agents.filter((a) => a.room === "standalone");

  return (
    <div className="min-h-screen relative">
      {/* Circuit board background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(90deg, transparent 49.5%, #0a162815 49.5%, #0a162815 50.5%, transparent 50.5%) 0 0 / 60px 60px,
            linear-gradient(0deg, transparent 49.5%, #0a162815 49.5%, #0a162815 50.5%, transparent 50.5%) 0 0 / 60px 60px,
            radial-gradient(circle 1.5px, #0d1f3a44 100%, transparent 100%) 0 0 / 60px 60px,
            #060a14
          `,
        }}
      />

      <div className="relative z-10 flex flex-col h-screen">
        {apiError && (
          <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-yellow-500/10 border-b border-yellow-500/20">
            <span className="font-mono text-[9px] text-yellow-400/80 tracking-wider uppercase">
              ⚠ API unreachable — showing cached data
            </span>
          </div>
        )}

        <Header
          agentCount={agents.length}
          workingCount={agents.filter((a) => a.status === "working").length}
          onAddAgent={() => setShowAddModal(true)}
        />

        <div className="flex-1 flex overflow-hidden">
          <TeamSidebar
            agents={filteredAgents}
            filter={sidebarFilter}
            onFilterChange={setSidebarFilter}
            onSelectAgent={setSelectedAgent}
          />

          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
            <OfficeFloor
              conferenceAgents={conferenceAgents}
              mainOfficeAgents={mainOfficeAgents}
              onSelectAgent={setSelectedAgent}
            />
            <WorkstationGrid
              agents={standaloneAgents}
              onSelectAgent={setSelectedAgent}
            />
          </div>
        </div>
      </div>

      {selectedAgent && (
        <AgentModal
          agent={selectedAgent}
          mode="edit"
          onSave={async (agent) => {
            await onUpdateAgent(agent);
            setSelectedAgent(null);
          }}
          onDelete={async () => {
            await onDeleteAgent(selectedAgent.id);
            setSelectedAgent(null);
          }}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {showAddModal && (
        <AgentModal
          mode="add"
          onSave={async (agent) => {
            await onAddAgent(agent);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
