"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type {
  BackofficeAgent,
  AgentStatus,
  RoomId,
} from "@/lib/backoffice/types";
import { PixelAvatar } from "./PixelAvatar";
import { useChinjanTheme } from "./chinjan/ChinjanThemeProvider";
import { findCharacterByRole } from "@/lib/backoffice/chinjan-characters";

const PixelCharacter = dynamic(
  () => import("./chinjan/PixelCharacter").then((m) => m.PixelCharacter),
  { ssr: false }
);

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

const STATUSES: { value: AgentStatus; label: string; cls: string; chinjanColor: string }[] = [
  { value: "working", label: "WORKING", cls: "text-green-400", chinjanColor: "var(--chinjan-green, #a8e6cf)" },
  { value: "idle", label: "IDLE", cls: "text-yellow-400", chinjanColor: "var(--chinjan-yellow, #ffd93d)" },
  { value: "offline", label: "OFFLINE", cls: "text-red-400", chinjanColor: "var(--chinjan-orange, #ffb347)" },
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
  const { isActive: isChinjan } = useChinjanTheme();

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

  const helper = findCharacterByRole('helper');

  const inputCls = isChinjan
    ? "w-full border-2 px-3 py-2 text-sm chinjan-mono focus:outline-none"
    : "w-full bg-[#060a14] border border-cyan-900/40 text-cyan-300 px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-500/40 uppercase";

  const inputStyle = isChinjan
    ? { background: 'var(--chinjan-bg)', borderColor: 'var(--chinjan-border)', color: 'var(--chinjan-text)' }
    : undefined;

  const labelCls = isChinjan
    ? "chinjan-mono text-xs block mb-1.5 uppercase tracking-wider"
    : "font-mono text-[9px] text-cyan-600/60 block mb-1.5 uppercase tracking-wider";

  const labelStyle = isChinjan
    ? { color: 'var(--chinjan-muted)' }
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className={`absolute inset-0 backdrop-blur-sm ${isChinjan ? 'bg-black/30' : 'bg-black/60'}`} />
      <div
        className={`relative w-full max-w-md mx-4 overflow-hidden ${isChinjan ? 'border-2' : 'border border-cyan-900/50'}`}
        style={isChinjan
          ? { borderColor: 'var(--chinjan-border)', background: 'var(--chinjan-surface)' }
          : { background: '#0a0e1a' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between px-4 py-3 border-b ${
            isChinjan ? 'border-[var(--chinjan-border)]' : 'border-cyan-900/30 bg-[#0d1225]'
          }`}
        >
          <span
            className={isChinjan
              ? 'chinjan-heading text-[9px] tracking-wider uppercase'
              : 'font-mono text-[11px] text-cyan-400 tracking-wider uppercase'}
            style={isChinjan ? { color: 'var(--chinjan-pink)' } : undefined}
          >
            {mode === "edit" ? `Edit: ${agent?.name}` : "New Agent"}
          </span>
          <button
            onClick={onClose}
            className={`text-lg ${isChinjan ? '' : 'text-cyan-600/50 hover:text-cyan-400'}`}
            style={isChinjan ? { color: 'var(--chinjan-muted)' } : undefined}
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex justify-center py-2 gap-4 items-end">
            <PixelAvatar color={form.color} status={form.status} size="lg" />
            {isChinjan && helper && (
              <PixelCharacter character={helper} size="sm" animation="wave" />
            )}
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Agent Name</label>
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className={inputCls}
              style={inputStyle}
              placeholder="AGENT NAME"
            />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Role</label>
            <input
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              className={inputCls}
              style={inputStyle}
              placeholder="e.g. Communications Agent"
            />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Activity</label>
            <input
              value={form.activity || ""}
              onChange={(e) => update("activity", e.target.value)}
              className={inputCls}
              style={inputStyle}
              placeholder="e.g. Processing messages..."
            />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Status</label>
            <div className="flex gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => update("status", s.value)}
                  className={isChinjan
                    ? `chinjan-mono text-sm px-3 py-1.5 border-2 transition-all tracking-wider`
                    : `font-mono text-[9px] px-3 py-1.5 border transition-all tracking-wider ${
                        form.status === s.value
                          ? `${s.cls} border-current bg-current/10`
                          : "text-cyan-700/40 border-cyan-900/30 hover:border-cyan-700/40"
                      }`}
                  style={isChinjan
                    ? {
                        color: form.status === s.value ? s.chinjanColor : 'var(--chinjan-muted)',
                        borderColor: form.status === s.value ? s.chinjanColor : 'var(--chinjan-border)',
                        background: form.status === s.value ? `color-mix(in srgb, ${s.chinjanColor} 10%, transparent)` : undefined,
                      }
                    : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Room</label>
            <select
              value={form.room}
              onChange={(e) => update("room", e.target.value)}
              className={inputCls}
              style={inputStyle}
            >
              {ROOMS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => update("color", c)}
                  className={`w-6 h-6 transition-all ${
                    form.color === c
                      ? isChinjan
                        ? "border-2 border-[var(--chinjan-text)] scale-110"
                        : "border-2 border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                      : "border-2 border-transparent hover:border-white/30"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {saveError && (
            <div
              className={isChinjan
                ? 'chinjan-mono text-xs border-2 px-3 py-2 tracking-wider'
                : 'font-mono text-[9px] text-red-400 border border-red-900/40 bg-red-500/5 px-3 py-2 tracking-wider'}
              style={isChinjan ? { color: '#ef4444', borderColor: '#ef4444', background: '#ef444410' } : undefined}
            >
              ERROR: {saveError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || isSaving}
              className={isChinjan
                ? 'flex-1 chinjan-mono text-sm border-2 py-2.5 transition-all disabled:opacity-40 uppercase tracking-wider'
                : 'flex-1 font-mono text-[10px] bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 py-2.5 hover:bg-cyan-500/25 transition-all disabled:opacity-40 uppercase tracking-wider'}
              style={isChinjan ? { borderColor: 'var(--chinjan-pink)', color: 'var(--chinjan-pink)', background: 'color-mix(in srgb, var(--chinjan-pink) 10%, transparent)' } : undefined}
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
                className={isChinjan
                  ? `chinjan-mono text-sm border-2 py-2.5 px-4 transition-all uppercase tracking-wider ${
                      confirmDelete ? 'bg-red-500/20' : ''
                    }`
                  : `font-mono text-[10px] border py-2.5 px-4 transition-all uppercase tracking-wider ${
                      confirmDelete
                        ? "bg-red-500/20 border-red-500/50 text-red-400"
                        : "bg-red-500/5 border-red-900/30 text-red-500/60 hover:border-red-500/40"
                    }`}
                style={isChinjan
                  ? {
                      borderColor: confirmDelete ? '#ef4444' : 'var(--chinjan-border)',
                      color: confirmDelete ? '#ef4444' : 'var(--chinjan-muted)',
                    }
                  : undefined}
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
