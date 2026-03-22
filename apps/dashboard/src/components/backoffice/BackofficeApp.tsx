"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { BackofficeAgent } from "@/lib/backoffice/types";
import { Header, type BackofficeTab } from "./Header";
import { TeamSidebar } from "./TeamSidebar";
import { OfficeFloor } from "./OfficeFloor";
import { AgentModal } from "./AgentModal";
import { CommandCenter } from "./CommandCenter";
import { AgentSettings } from "./AgentSettings";
import { RetroDeskOnly, DefaultOnly } from "./retrodesk/RetroDeskThemeProvider";

const ChatBox = dynamic(
  () => import("./chat/ChatBox").then((m) => m.ChatBox),
  { ssr: false }
);

const RetroDeskErrorState = dynamic(
  () => import("./retrodesk/RetroDeskErrorState").then((m) => m.RetroDeskErrorState),
  { ssr: false }
);
const PixelStar = dynamic(
  () => import("./retrodesk/PixelDecorations").then((m) => m.PixelStar),
  { ssr: false }
);
const PixelCloud = dynamic(
  () => import("./retrodesk/PixelDecorations").then((m) => m.PixelCloud),
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const toggleMobileSidebar = useCallback(() => setMobileSidebarOpen((v) => !v), []);
  const toggleChat = useCallback(() => setChatOpen((v) => !v), []);
  const filteredAgents =
    sidebarFilter === "all"
      ? agents
      : agents.filter((a) => a.status === sidebarFilter);

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <DefaultOnly>
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `
              linear-gradient(90deg, transparent 49.5%, var(--bo-border-subtle) 49.5%, var(--bo-border-subtle) 50.5%, transparent 50.5%) 0 0 / 60px 60px,
              linear-gradient(0deg, transparent 49.5%, var(--bo-border-subtle) 49.5%, var(--bo-border-subtle) 50.5%, transparent 50.5%) 0 0 / 60px 60px,
              radial-gradient(circle 1.5px, var(--bo-border) 100%, transparent 100%) 0 0 / 60px 60px,
              var(--bo-bg-deep)
            `,
          }}
        />
      </DefaultOnly>
      <RetroDeskOnly>
        <div className="fixed inset-0 pointer-events-none retrodesk-grid-bg" />
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <PixelCloud className="absolute top-8 left-[10%]" px={2} />
          <PixelCloud className="absolute top-16 right-[15%]" px={3} />
          <PixelStar className="absolute top-24 left-[30%]" px={2} />
          <PixelStar className="absolute top-12 right-[35%]" px={3} />
          <PixelStar className="absolute bottom-20 left-[20%]" px={2} />
          <PixelStar className="absolute bottom-32 right-[25%]" px={2} />
        </div>
      </RetroDeskOnly>

      <div className="relative z-10 flex flex-col h-screen transition-colors duration-300">
        {apiError && (
          <>
            <DefaultOnly>
              <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-100 dark:bg-yellow-500/10 border-b border-amber-200 dark:border-yellow-500/20">
                <span className="font-mono text-[9px] text-amber-700 dark:text-yellow-400/80 tracking-wider uppercase">
                  ⚠ API unreachable — showing cached data
                </span>
              </div>
            </DefaultOnly>
            <RetroDeskOnly>
              <RetroDeskErrorState />
            </RetroDeskOnly>
          </>
        )}

        <Header
          agentCount={agents.length}
          workingCount={agents.filter((a) => a.status === "working").length}
          onAddAgent={() => setShowAddModal(true)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onToggleMobileSidebar={toggleMobileSidebar}
          chatOpen={chatOpen}
          onToggleChat={toggleChat}
        />

        {activeTab === "overview" && (
          <div className="flex-1 flex overflow-hidden relative">
            {/* Mobile sidebar overlay */}
            {mobileSidebarOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                onClick={() => setMobileSidebarOpen(false)}
              />
            )}
            <TeamSidebar
              agents={filteredAgents}
              filter={sidebarFilter}
              onFilterChange={setSidebarFilter}
              onSelectAgent={(agent) => {
                setSelectedAgent(agent);
                setMobileSidebarOpen(false);
              }}
              onOpenTerminal={setTerminalAgent}
              mobileOpen={mobileSidebarOpen}
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />

            <div className="flex-1 overflow-hidden relative">
              <OfficeFloor
                agents={agents}
                onSelectAgent={setSelectedAgent}
              />
            </div>

            {/* Desktop chat panel (always visible on lg+) */}
            <div className="hidden lg:flex w-[380px] border-l border-[var(--bo-border)] flex-col">
              <ChatBox />
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

      {/* Chat slide-in panel */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={toggleChat} />
          <div className="relative w-full max-w-md h-full animate-in slide-in-from-right duration-200">
            <ChatBox />
          </div>
        </div>
      )}
    </div>
  );
}
