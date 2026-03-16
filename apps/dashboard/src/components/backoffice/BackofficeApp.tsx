"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { BackofficeAgent } from "@/lib/backoffice/types";
import { Header, type BackofficeTab } from "./Header";
import { TeamSidebar } from "./TeamSidebar";
import { OfficeFloor } from "./OfficeFloor";
import { WorkstationGrid } from "./WorkstationGrid";
import { AgentModal } from "./AgentModal";
import { CommandCenter } from "./CommandCenter";
import { AgentSettings } from "./AgentSettings";
import { ChinjanOnly, DefaultOnly } from "./chinjan/ChinjanThemeProvider";

const ChinjanErrorState = dynamic(
  () => import("./chinjan/ChinjanErrorState").then((m) => m.ChinjanErrorState),
  { ssr: false }
);
const PixelStar = dynamic(
  () => import("./chinjan/PixelDecorations").then((m) => m.PixelStar),
  { ssr: false }
);
const PixelCloud = dynamic(
  () => import("./chinjan/PixelDecorations").then((m) => m.PixelCloud),
  { ssr: false }
);
const AgentTerminal = dynamic(
  () => import("./AgentTerminal").then((m) => m.AgentTerminal),
  { ssr: false }
);

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
  const [activeTab, setActiveTab] = useState<BackofficeTab>("overview");
  const [selectedAgent, setSelectedAgent] = useState<BackofficeAgent | null>(
    null,
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [terminalAgent, setTerminalAgent] = useState<BackofficeAgent | null>(
    null,
  );
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
      {/* Background */}
      <DefaultOnly>
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
      </DefaultOnly>
      <ChinjanOnly>
        <div className="fixed inset-0 pointer-events-none chinjan-grid-bg" />
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <PixelCloud className="absolute top-8 left-[10%]" px={2} />
          <PixelCloud className="absolute top-16 right-[15%]" px={3} />
          <PixelStar className="absolute top-24 left-[30%]" px={2} />
          <PixelStar className="absolute top-12 right-[35%]" px={3} />
          <PixelStar className="absolute bottom-20 left-[20%]" px={2} />
          <PixelStar className="absolute bottom-32 right-[25%]" px={2} />
        </div>
      </ChinjanOnly>

      <div className="relative z-10 flex flex-col h-screen">
        {apiError && (
          <>
            <DefaultOnly>
              <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-yellow-500/10 border-b border-yellow-500/20">
                <span className="font-mono text-[9px] text-yellow-400/80 tracking-wider uppercase">
                  ⚠ API unreachable — showing cached data
                </span>
              </div>
            </DefaultOnly>
            <ChinjanOnly>
              <ChinjanErrorState />
            </ChinjanOnly>
          </>
        )}

        <Header
          agentCount={agents.length}
          workingCount={agents.filter((a) => a.status === "working").length}
          onAddAgent={() => setShowAddModal(true)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {activeTab === "overview" && (
          <div className="flex-1 flex overflow-hidden">
            <TeamSidebar
              agents={filteredAgents}
              filter={sidebarFilter}
              onFilterChange={setSidebarFilter}
              onSelectAgent={setSelectedAgent}
              onOpenTerminal={setTerminalAgent}
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
        )}

        {activeTab === "commander" && (
          <div className="flex-1 overflow-hidden p-4 lg:p-6">
            <CommandCenter />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="max-w-lg mx-auto">
              <AgentSettings />
            </div>
          </div>
        )}
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

      {terminalAgent && (
        <AgentTerminal
          agent={terminalAgent}
          open={!!terminalAgent}
          onClose={() => setTerminalAgent(null)}
        />
      )}
    </div>
  );
}
