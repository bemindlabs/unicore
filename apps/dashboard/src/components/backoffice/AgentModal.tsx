"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import type {
  BackofficeAgent,
  AgentStatus,
  RoomId,
} from "@/lib/backoffice/types";
import { PixelAvatar } from "./PixelAvatar";
import { useRetroDeskTheme } from "./retrodesk/RetroDeskThemeProvider";
import { findCharacterByRole } from "@/lib/backoffice/retrodesk-characters";

const PixelCharacter = dynamic(
  () => import("./retrodesk/PixelCharacter").then((m) => m.PixelCharacter),
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

const STATUSES: { value: AgentStatus; label: string; cls: string; retrodeskColor: string }[] = [
  { value: "working", label: "WORKING", cls: "text-green-400", retrodeskColor: "var(--retrodesk-green, #a8e6cf)" },
  { value: "idle", label: "IDLE", cls: "text-yellow-400", retrodeskColor: "var(--retrodesk-yellow, #ffd93d)" },
  { value: "offline", label: "OFFLINE", cls: "text-red-400", retrodeskColor: "var(--retrodesk-orange, #ffb347)" },
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
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);

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
  const { isActive: isRetroDesk } = useRetroDeskTheme();

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

  const inputCls = isRetroDesk
    ? "w-full border-2 px-3 py-2 text-sm retrodesk-mono focus:outline-none"
    : "w-full bg-[var(--bo-bg-input)] border border-[var(--bo-border-strong)] text-[var(--bo-text-accent-2)] px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--bo-border-accent-hover)] uppercase";

  const inputStyle = isRetroDesk
    ? { background: 'var(--retrodesk-bg)', borderColor: 'var(--retrodesk-border)', color: 'var(--retrodesk-text)' }
    : undefined;

  const labelCls = isRetroDesk
    ? "retrodesk-mono text-xs block mb-1.5 uppercase tracking-wider"
    : "font-mono text-[9px] text-[var(--bo-text-muted)] block mb-1.5 uppercase tracking-wider";

  const labelStyle = isRetroDesk
    ? { color: 'var(--retrodesk-muted)' }
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className={`absolute inset-0 backdrop-blur-sm ${isRetroDesk ? 'bg-black/30' : 'bg-black/60'}`} />
      <div
        className={`relative w-full max-w-md mx-0 sm:mx-4 h-full sm:h-auto max-h-full sm:max-h-[90vh] overflow-y-auto overflow-x-hidden ${isRetroDesk ? 'border-0 sm:border-2' : 'border-0 sm:border border-[var(--bo-border-strong)]'}`}
        style={isRetroDesk
          ? { borderColor: 'var(--retrodesk-border)', background: 'var(--retrodesk-surface)' }
          : { background: 'var(--bo-bg)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-modal-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between px-4 py-3 border-b ${
            isRetroDesk ? 'border-[var(--retrodesk-border)]' : 'border-[var(--bo-border)] bg-[var(--bo-bg-elevated)]'
          }`}
        >
          <span
            id="agent-modal-title"
            className={isRetroDesk
              ? 'retrodesk-heading text-[9px] tracking-wider uppercase'
              : 'font-mono text-[11px] text-[var(--bo-text-accent)] tracking-wider uppercase'}
            style={isRetroDesk ? { color: 'var(--retrodesk-pink)' } : undefined}
          >
            {mode === "edit" ? `Edit: ${agent?.name}` : "New Agent"}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className={`text-lg ${isRetroDesk ? '' : 'text-[var(--bo-text-muted)] hover:text-[var(--bo-text-accent)]'}`}
            style={isRetroDesk ? { color: 'var(--retrodesk-muted)' } : undefined}
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex justify-center py-2 gap-4 items-end">
            <PixelAvatar color={form.color} status={form.status} size="lg" />
            {isRetroDesk && helper && (
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
                  className={isRetroDesk
                    ? `retrodesk-mono text-sm px-3 py-1.5 border-2 transition-all tracking-wider`
                    : `font-mono text-[9px] px-3 py-1.5 border transition-all tracking-wider ${
                        form.status === s.value
                          ? `${s.cls} border-current bg-current/10`
                          : "text-[var(--bo-text-dimmer)] border-[var(--bo-border)] hover:border-[var(--bo-border-accent)]"
                      }`}
                  style={isRetroDesk
                    ? {
                        color: form.status === s.value ? s.retrodeskColor : 'var(--retrodesk-muted)',
                        borderColor: form.status === s.value ? s.retrodeskColor : 'var(--retrodesk-border)',
                        background: form.status === s.value ? `color-mix(in srgb, ${s.retrodeskColor} 10%, transparent)` : undefined,
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
                      ? isRetroDesk
                        ? "border-2 border-[var(--retrodesk-text)] scale-110"
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
              className={isRetroDesk
                ? 'retrodesk-mono text-xs border-2 px-3 py-2 tracking-wider'
                : 'font-mono text-[9px] text-red-400 border border-red-900/40 bg-red-500/5 px-3 py-2 tracking-wider'}
              style={isRetroDesk ? { color: '#ef4444', borderColor: '#ef4444', background: '#ef444410' } : undefined}
            >
              ERROR: {saveError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || isSaving}
              className={isRetroDesk
                ? 'flex-1 retrodesk-mono text-sm border-2 py-2.5 transition-all disabled:opacity-40 uppercase tracking-wider'
                : 'flex-1 font-mono text-[10px] bg-[var(--bo-accent-15)] border border-[var(--bo-border-accent)] text-[var(--bo-text-accent)] py-2.5 hover:bg-[var(--bo-accent-20)] transition-all disabled:opacity-40 uppercase tracking-wider'}
              style={isRetroDesk ? { borderColor: 'var(--retrodesk-pink)', color: 'var(--retrodesk-pink)', background: 'color-mix(in srgb, var(--retrodesk-pink) 10%, transparent)' } : undefined}
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
                className={isRetroDesk
                  ? `retrodesk-mono text-sm border-2 py-2.5 px-4 transition-all uppercase tracking-wider ${
                      confirmDelete ? 'bg-red-500/20' : ''
                    }`
                  : `font-mono text-[10px] border py-2.5 px-4 transition-all uppercase tracking-wider ${
                      confirmDelete
                        ? "bg-red-500/20 border-red-500/50 text-red-400"
                        : "bg-red-500/5 border-red-900/30 text-red-500/60 hover:border-red-500/40"
                    }`}
                style={isRetroDesk
                  ? {
                      borderColor: confirmDelete ? '#ef4444' : 'var(--retrodesk-border)',
                      color: confirmDelete ? '#ef4444' : 'var(--retrodesk-muted)',
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
