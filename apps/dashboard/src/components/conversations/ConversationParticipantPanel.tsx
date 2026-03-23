'use client';

/**
 * ConversationParticipantPanel — UNC-1031
 *
 * Renders in the conversation header:
 *   - Participant list (humans + AI agents) with colour-coded avatars
 *   - Agent status indicators (working / idle / offline)
 *   - Add Agent / Remove Agent buttons
 *   - Auto-respond toggle per AI agent (fire-and-forget PATCH)
 *   - Real-time updates via Socket.IO (participants:update)
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Bot,
  User2,
  Plus,
  X,
  ChevronDown,
  Loader2,
  Zap,
  ZapOff,
} from 'lucide-react';
import {
  Button,
  Badge,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  cn,
  toast,
} from '@unicore/ui';
import {
  useConversationParticipants,
  type ConversationParticipant,
  type AddParticipantPayload,
} from '@/hooks/use-conversation-participants';
import { getAgents } from '@/lib/backoffice/store';
import type { BackofficeAgent } from '@/lib/backoffice/types';

// ─── Status indicator ─────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  working: 'bg-emerald-500',
  idle:    'bg-amber-400',
  offline: 'bg-zinc-400',
};

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
        STATUS_COLORS[status] ?? 'bg-zinc-400',
      )}
    />
  );
}

// ─── Participant avatar ───────────────────────────────────────────────────

function ParticipantAvatar({
  participant,
  agentStatus,
}: {
  participant: ConversationParticipant;
  agentStatus?: string;
}) {
  const isAI = participant.participantType === 'AGENT';
  const initials = participant.participantName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative inline-flex shrink-0">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white select-none"
        style={{ backgroundColor: participant.participantColor }}
      >
        {isAI ? <Bot className="h-3.5 w-3.5" /> : initials}
      </span>
      {agentStatus && <StatusDot status={agentStatus} />}
    </div>
  );
}

// ─── Add Agent dialog ────────────────────────────────────────────────────

function AddAgentDialog({
  conversationId,
  existingIds,
  onAdd,
  onClose,
}: {
  conversationId: string;
  existingIds: Set<string>;
  onAdd: (payload: AddParticipantPayload) => Promise<void>;
  onClose: () => void;
}) {
  const [agents, setAgents] = useState<BackofficeAgent[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    getAgents().then(({ agents }) => setAgents(agents));
  }, []);

  const handleAdd = useCallback(
    async (agent: BackofficeAgent) => {
      setAdding(agent.id);
      try {
        await onAdd({
          participantId: agent.id,
          participantType: 'AGENT',
          participantName: agent.name,
          participantColor: agent.color,
          autoRespond: true,
        });
        toast({ title: `${agent.name} added`, description: 'Agent is now in this conversation.' });
      } catch (err: any) {
        toast({ title: 'Failed to add agent', description: err?.message ?? 'Please try again.', variant: 'destructive' });
      } finally {
        setAdding(null);
      }
    },
    [onAdd],
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Add Agent
          </DialogTitle>
          <DialogDescription>
            Select an AI agent to join this conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 max-h-60 overflow-y-auto">
          {agents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No agents available</p>
          )}
          {agents.map((agent) => {
            const isPresent = existingIds.has(agent.id);
            return (
              <button
                key={agent.id}
                disabled={isPresent || adding === agent.id}
                onClick={() => handleAdd(agent)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isPresent
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-muted cursor-pointer',
                )}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: agent.color }}
                >
                  <Bot className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1 text-left">
                  <p className="font-medium leading-none">{agent.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{agent.role}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      STATUS_COLORS[agent.status] ?? 'bg-zinc-400',
                    )}
                  />
                  {adding === agent.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  {isPresent && <Badge variant="secondary" className="text-[10px]">In chat</Badge>}
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Participant row in the popover ──────────────────────────────────────

function ParticipantRow({
  participant,
  agentStatus,
  onRemove,
  onToggleAutoRespond,
  removing,
  toggling,
}: {
  participant: ConversationParticipant;
  agentStatus?: string;
  onRemove: () => void;
  onToggleAutoRespond: (v: boolean) => void;
  removing: boolean;
  toggling: boolean;
}) {
  const isAI = participant.participantType === 'AGENT';

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group">
      <ParticipantAvatar participant={participant} agentStatus={agentStatus} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-none truncate">{participant.participantName}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {isAI ? 'AI Agent' : 'Human'}
          {agentStatus && ` · ${agentStatus}`}
        </p>
      </div>

      {/* Auto-respond toggle — AI agents only */}
      {isAI && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 shrink-0">
                {participant.autoRespond ? (
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <ZapOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <Switch
                  checked={participant.autoRespond}
                  disabled={toggling}
                  onCheckedChange={onToggleAutoRespond}
                  className="scale-75"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="left">
              {participant.autoRespond ? 'Auto-respond enabled' : 'Auto-respond disabled'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        disabled={removing}
        className="ml-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Remove ${participant.participantName}`}
      >
        {removing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <X className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────

interface ConversationParticipantPanelProps {
  conversationId: string | null;
  /** Live agent status map from the backoffice store (agentId → status) */
  agentStatusMap?: Record<string, string>;
  className?: string;
}

export function ConversationParticipantPanel({
  conversationId,
  agentStatusMap = {},
  className,
}: ConversationParticipantPanelProps) {
  const {
    participants,
    loading,
    addParticipant,
    removeParticipant,
    toggleAutoRespond,
  } = useConversationParticipants(conversationId);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleRemove = useCallback(
    async (participantId: string) => {
      setRemovingId(participantId);
      try {
        await removeParticipant(participantId);
        toast({ title: 'Participant removed' });
      } catch (err: any) {
        toast({ title: 'Failed to remove participant', description: err?.message, variant: 'destructive' });
      } finally {
        setRemovingId(null);
      }
    },
    [removeParticipant],
  );

  const handleToggleAutoRespond = useCallback(
    async (participantId: string, value: boolean) => {
      setTogglingId(participantId);
      try {
        await toggleAutoRespond(participantId, value);
      } catch (err: any) {
        toast({ title: 'Failed to update', description: err?.message, variant: 'destructive' });
      } finally {
        setTogglingId(null);
      }
    },
    [toggleAutoRespond],
  );

  if (!conversationId) return null;

  const existingIds = new Set(participants.map((p) => p.participantId));
  const aiCount = participants.filter((p) => p.participantType === 'AGENT').length;
  const humanCount = participants.filter((p) => p.participantType !== 'AGENT').length;

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors',
              className,
            )}
            aria-label="Manage conversation participants"
          >
            {/* Stacked avatars preview */}
            <div className="flex -space-x-1.5">
              {participants.slice(0, 4).map((p) => (
                <span
                  key={p.participantId}
                  className="flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background text-[8px] text-white font-bold"
                  style={{ backgroundColor: p.participantColor }}
                >
                  {p.participantType === 'AGENT' ? (
                    <Bot className="h-2.5 w-2.5" />
                  ) : (
                    p.participantName[0]?.toUpperCase()
                  )}
                </span>
              ))}
              {participants.length === 0 && !loading && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <User2 className="h-2.5 w-2.5" />
                </span>
              )}
            </div>

            <span>
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  {humanCount > 0 && <span>{humanCount} human{humanCount !== 1 ? 's' : ''}</span>}
                  {humanCount > 0 && aiCount > 0 && <span>, </span>}
                  {aiCount > 0 && <span>{aiCount} agent{aiCount !== 1 ? 's' : ''}</span>}
                  {participants.length === 0 && 'No participants'}
                </>
              )}
            </span>

            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-72 p-2">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Participants
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-6 gap-1 text-xs px-2"
              onClick={() => {
                setPopoverOpen(false);
                setShowAddDialog(true);
              }}
            >
              <Plus className="h-3 w-3" />
              Add Agent
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : participants.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No participants yet
            </p>
          ) : (
            <div className="space-y-0.5">
              {/* Humans first */}
              {participants
                .filter((p) => p.participantType !== 'AGENT')
                .map((p) => (
                  <ParticipantRow
                    key={p.participantId}
                    participant={p}
                    agentStatus={agentStatusMap[p.participantId]}
                    onRemove={() => handleRemove(p.participantId)}
                    onToggleAutoRespond={(v) => handleToggleAutoRespond(p.participantId, v)}
                    removing={removingId === p.participantId}
                    toggling={togglingId === p.participantId}
                  />
                ))}

              {/* AI agents */}
              {participants.filter((p) => p.participantType === 'AGENT').length > 0 && (
                <>
                  <div className="border-t border-border/50 my-1" />
                  <p className="px-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide py-0.5">
                    AI Agents
                  </p>
                  {participants
                    .filter((p) => p.participantType === 'AGENT')
                    .map((p) => (
                      <ParticipantRow
                        key={p.participantId}
                        participant={p}
                        agentStatus={agentStatusMap[p.participantId]}
                        onRemove={() => handleRemove(p.participantId)}
                        onToggleAutoRespond={(v) => handleToggleAutoRespond(p.participantId, v)}
                        removing={removingId === p.participantId}
                        toggling={togglingId === p.participantId}
                      />
                    ))}
                </>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="border-t border-border/50 mt-2 pt-2 px-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-2.5 w-2.5 text-amber-500" /> Auto-respond on
            </span>
            <span className="flex items-center gap-1">
              <ZapOff className="h-2.5 w-2.5" /> Manual mode
            </span>
          </div>
        </PopoverContent>
      </Popover>

      {showAddDialog && conversationId && (
        <AddAgentDialog
          conversationId={conversationId}
          existingIds={existingIds}
          onAdd={(payload: AddParticipantPayload) => addParticipant(payload).then(() => undefined)}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </>
  );
}
