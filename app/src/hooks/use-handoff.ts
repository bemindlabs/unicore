'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';

export type HandoffTrigger = 'low_confidence' | 'explicit_request' | 'user_request';
export type HandoffStatus = 'pending' | 'active' | 'resolved' | 'ai_resumed';

export interface Handoff {
  id: string;
  channel: string;
  userId: string;
  trigger: HandoffTrigger;
  confidence: number | null;
  status: HandoffStatus;
  assignedTo: string | null;
  contextSummary: string | null;
  slaMinutes: number;
  slaDeadline: string;
  slaBreached: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

interface UseHandoffReturn {
  handoff: Handoff | null;
  /** Seconds remaining until SLA breaches; null when no active handoff */
  slaSecondsRemaining: number | null;
  /** Human claims the handoff (takes ownership) */
  claimHandoff: (operatorId: string) => Promise<void>;
  /** Human resolves the conversation */
  resolveHandoff: () => Promise<void>;
  /** Human lets AI resume handling ("Let AI Handle") */
  resumeAI: () => Promise<void>;
  /** Notify the hook that a new handoff was just created (from a WS message) */
  setHandoffFromMessage: (h: { id: string; slaDeadline: string; trigger: string }) => void;
  loading: boolean;
  error: string | null;
}

/**
 * useHandoff — manages the handoff state for a given conversation channel.
 *
 * Polls the active handoff for the channel and tracks SLA countdown.
 */
export function useHandoff(channel: string): UseHandoffReturn {
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [slaSecondsRemaining, setSlaSecondsRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch active handoff for channel
  const fetchHandoff = useCallback(async () => {
    if (!channel) return;
    try {
      const encoded = encodeURIComponent(channel);
      const res = await api.get<{ handoff: Handoff | null }>(
        `/api/v1/handoffs/channel/${encoded}`,
      );
      setHandoff(res?.handoff ?? null);
    } catch {
      // Ignore — handoff endpoint may not exist on older deployments
    }
  }, [channel]);

  // Poll on mount and when channel changes
  useEffect(() => {
    setHandoff(null);
    fetchHandoff();
  }, [fetchHandoff]);

  // SLA countdown timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (!handoff || handoff.status === 'resolved' || handoff.status === 'ai_resumed') {
      setSlaSecondsRemaining(null);
      return;
    }

    function tick() {
      if (!handoff) return;
      const remaining = Math.max(
        0,
        Math.floor((new Date(handoff.slaDeadline).getTime() - Date.now()) / 1000),
      );
      setSlaSecondsRemaining(remaining);
    }

    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [handoff]);

  // Allow WS message to inject handoff without a fetch round-trip
  const setHandoffFromMessage = useCallback(
    (h: { id: string; slaDeadline: string; trigger: string }) => {
      // Fetch the full handoff record
      api
        .get<Handoff>(`/api/v1/handoffs/${h.id}`)
        .then((full) => setHandoff(full))
        .catch(() => {
          // Fallback: set minimal data so the banner appears
          setHandoff({
            id: h.id,
            channel,
            userId: '',
            trigger: h.trigger as HandoffTrigger,
            confidence: null,
            status: 'pending',
            assignedTo: null,
            contextSummary: null,
            slaMinutes: 15,
            slaDeadline: h.slaDeadline,
            slaBreached: false,
            resolvedAt: null,
            createdAt: new Date().toISOString(),
          });
        });
    },
    [channel],
  );

  const claimHandoff = useCallback(
    async (operatorId: string) => {
      if (!handoff) return;
      setLoading(true);
      setError(null);
      try {
        const updated = await api.post<Handoff>(`/api/v1/handoffs/${handoff.id}/claim`, {
          operatorId,
        });
        setHandoff(updated);
      } catch (err) {
        setError('Failed to claim handoff');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [handoff],
  );

  const resolveHandoff = useCallback(async () => {
    if (!handoff) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await api.post<Handoff>(`/api/v1/handoffs/${handoff.id}/resolve`, {});
      setHandoff(updated);
    } catch (err) {
      setError('Failed to resolve handoff');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handoff]);

  const resumeAI = useCallback(async () => {
    if (!handoff) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await api.post<Handoff>(`/api/v1/handoffs/${handoff.id}/resume-ai`, {});
      setHandoff(updated);
    } catch (err) {
      setError('Failed to resume AI');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handoff]);

  return {
    handoff,
    slaSecondsRemaining,
    claimHandoff,
    resolveHandoff,
    resumeAI,
    setHandoffFromMessage,
    loading,
    error,
  };
}
