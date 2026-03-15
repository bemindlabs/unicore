"use client";

import { useState } from "react";
import type {
  BackofficeAgent,
  AgentStatus,
  RoomId,
} from "@/lib/backoffice/types";
import { PixelAvatar } from "./PixelAvatar";

interface Props {
  agent?: BackofficeAgent;
  mode: "edit" | "add";
  onSave: (agent: BackofficeAgent) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

const ROOMS: { value: RoomId; label: string }[] = [
  { value: "conference", label: "Conference Room" },
  { value: "main-office", label: "Command Center" },
  { value: "standalone", label: "Standalone Workstation" },
];

const STATUSES: { value: AgentStatus; label: string; cls: string }[] = [
  { value: "working", label: "WORKING", cls: "text-green-400" },
  { value: "idle", label: "IDLE", cls: "text-yellow-400" },
  { value: "offline", label: "OFFLINE", cls: "text-red-400" },
];

const COLORS = [
  "#00e5ff",
  "#4fc3f7",
  "#ce93d8",
  "#81c784",
  "#ef5350",
  "#7c4dff",
  "#ffb74d",
  "#4dd0e1",
  "#f06292",
  "#aed581",
];

export function AgentModal({ agent, mode, onSave, onDelete, onClose }: Props) {
  const [form, setForm] = useState<BackofficeAgent>(
    agent || {
      id: "",
      name: "",
      role: "",
      status: "idle",
      room: "standalone",
      activity: "",
      color: "#00e5ff",
      deskItems: [],
    },
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function update(field: keyof BackofficeAgent, value: string | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaveError(null);
  }

  async function handleSave() {
    if (!form.name.trim() || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        ...form,
        id: form.id || form.name.toLowerCase().replace(/\s+/g, "-"),
        name: form.name.toUpperCase(),
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md mx-4 border border-cyan-900/50 bg-[#0a0e1a] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-900/30 bg-[#0d1225]">
          <span className="font-mono text-[11px] text-cyan-400 tracking-wider uppercase">
            {mode === "edit" ? `Edit: ${agent?.name}` : "New Agent"}
          </span>
          <button
            onClick={onClose}
            className="text-cyan-600/50 hover:text-cyan-400 text-lg"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex justify-center py-2">
            <PixelAvatar color={form.color} status={form.status} size="lg" />
          </div>

          <div>
            <label className="font-mono text-[9px] text-cyan-600/60 block mb-1.5 uppercase tracking-wider">
              Agent Name
            </label>
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full bg-[#060a14] border border-cyan-900/40 text-cyan-300 px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-500/40 uppercase"
              placeholder="AGENT NAME"
            />
          </div>

          <div>
            <label className="font-mono text-[9px] text-cyan-600/60 block mb-1.5 uppercase tracking-wider">
              Role
            </label>
            <input
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              className="w-full bg-[#060a14] border border-cyan-900/40 text-cyan-300 px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-500/40"
              placeholder="e.g. Communications Agent"
            />
          </div>

          <div>
            <label className="font-mono text-[9px] text-cyan-600/60 block mb-1.5 uppercase tracking-wider">
              Activity
            </label>
            <input
              value={form.activity || ""}
              onChange={(e) => update("activity", e.target.value)}
              className="w-full bg-[#060a14] border border-cyan-900/40 text-cyan-300 px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-500/40"
              placeholder="e.g. Processing messages..."
            />
          </div>

          <div>
            <label className="font-mono text-[9px] text-cyan-600/60 block mb-1.5 uppercase tracking-wider">
              Status
            </label>
            <div className="flex gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => update("status", s.value)}
                  className={`font-mono text-[9px] px-3 py-1.5 border transition-all tracking-wider ${
                    form.status === s.value
                      ? `${s.cls} border-current bg-current/10`
                      : "text-cyan-700/40 border-cyan-900/30 hover:border-cyan-700/40"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-mono text-[9px] text-cyan-600/60 block mb-1.5 uppercase tracking-wider">
              Room
            </label>
            <select
              value={form.room}
              onChange={(e) => update("room", e.target.value)}
              className="w-full bg-[#060a14] border border-cyan-900/40 text-cyan-300 px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-500/40"
            >
              {ROOMS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-mono text-[9px] text-cyan-600/60 block mb-1.5 uppercase tracking-wider">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => update("color", c)}
                  className={`w-6 h-6 border-2 transition-all ${
                    form.color === c
                      ? "border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                      : "border-transparent hover:border-white/30"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {saveError && (
            <div className="font-mono text-[9px] text-red-400 border border-red-900/40 bg-red-500/5 px-3 py-2 tracking-wider">
              ERROR: {saveError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || isSaving}
              className="flex-1 font-mono text-[10px] bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 py-2.5 hover:bg-cyan-500/25 transition-all disabled:opacity-40 uppercase tracking-wider"
            >
              {isSaving
                ? "SAVING..."
                : mode === "edit"
                  ? "Update Agent"
                  : "Create Agent"}
            </button>
            {mode === "edit" && onDelete && (
              <button
                onClick={() => {
                  if (confirmDelete) void onDelete();
                  else setConfirmDelete(true);
                }}
                className={`font-mono text-[10px] border py-2.5 px-4 transition-all uppercase tracking-wider ${
                  confirmDelete
                    ? "bg-red-500/20 border-red-500/50 text-red-400"
                    : "bg-red-500/5 border-red-900/30 text-red-500/60 hover:border-red-500/40"
                }`}
              >
                {confirmDelete ? "Confirm?" : "Delete"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
