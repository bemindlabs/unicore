'use client';

/**
 * useConversationParticipants — UNC-1031
 *
 * Manages the participant list for a conversation:
 *   - Fetches participants via REST
 *   - Subscribes to real-time `participants:update` events via Socket.IO
 *   - Exposes add / remove / toggleAutoRespond / updateColor helpers
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { api } from '@/lib/api';

const CONVERSATIONS_NS =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? '') + '/conversations'
    : '/conversations';

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  participantId: string;
  /** "USER" | "AGENT" */
  participantType: string;
  participantName: string;
  participantColor: string;
  /** Applicable to AI agents only */
  autoRespond: boolean;
  role: string;
  autoAssigned: boolean;
  isActive: boolean;
  joinedAt: string;
  leftAt: string | null;
}

export interface AddParticipantPayload {
  participantId: string;
  /** "USER" | "AGENT" */
  participantType: 'USER' | 'AGENT';
  participantName: string;
  participantColor?: string;
  autoRespond?: boolean;
}

export function useConversationParticipants(conversationId: string | null) {
  const [participants, setParticipants] = useState<ConversationParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<any>(null);

  // ─── Fetch initial participant list ──────────────────────────────────────

  const fetchParticipants = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ConversationParticipant[]>(
        `/api/v1/conversations/${conversationId}/participants`,
      );
      setParticipants(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load participants');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  // ─── Real-time Socket.IO subscription ────────────────────────────────────

  useEffect(() => {
    if (!conversationId || typeof window === 'undefined') return;

    let socket: any = null;

    (async () => {
      try {
        // Dynamic import so Next.js doesn't bundle socket.io-client in SSR
        const { io } = await import('socket.io-client');
        socket = io(CONVERSATIONS_NS, {
          transports: ['websocket'],
          auth: { token: localStorage.getItem('auth_token') ?? '' },
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit('join', conversationId);
        });

        socket.on(
          'participants:update',
          (payload: { conversationId: string; action: string; participant?: ConversationParticipant; participantId?: string }) => {
            if (payload.conversationId !== conversationId) return;

            if (payload.action === 'added' && payload.participant) {
              setParticipants((prev) => {
                const exists = prev.find((p) => p.participantId === payload.participant!.participantId);
                return exists
                  ? prev.map((p) => (p.participantId === payload.participant!.participantId ? payload.participant! : p))
                  : [...prev, payload.participant!];
              });
            } else if (payload.action === 'removed' && payload.participantId) {
              setParticipants((prev) =>
                prev.filter((p) => p.participantId !== payload.participantId),
              );
            } else if (payload.action === 'updated' && payload.participant) {
              setParticipants((prev) =>
                prev.map((p) =>
                  p.participantId === payload.participant!.participantId ? { ...p, ...payload.participant } : p,
                ),
              );
            }
          },
        );
      } catch {
        // socket.io-client not available — fall back to polling
      }
    })();

    return () => {
      if (socket) {
        socket.emit('leave', conversationId);
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [conversationId]);

  // ─── Mutations ───────────────────────────────────────────────────────────

  const addParticipant = useCallback(
    async (payload: AddParticipantPayload): Promise<ConversationParticipant> => {
      if (!conversationId) throw new Error('No conversation selected');
      const participant = await api.post<ConversationParticipant>(
        `/api/v1/conversations/${conversationId}/participants`,
        payload,
      );
      // Optimistic update (socket will also arrive but de-duped)
      setParticipants((prev) => {
        const exists = prev.find((p) => p.participantId === participant.participantId);
        return exists ? prev.map((p) => (p.participantId === participant.participantId ? participant : p)) : [...prev, participant];
      });
      return participant;
    },
    [conversationId],
  );

  const removeParticipant = useCallback(
    async (participantId: string): Promise<void> => {
      if (!conversationId) throw new Error('No conversation selected');
      await api.delete(`/api/v1/conversations/${conversationId}/participants/${participantId}`);
      setParticipants((prev) => prev.filter((p) => p.participantId !== participantId));
    },
    [conversationId],
  );

  const toggleAutoRespond = useCallback(
    async (participantId: string, autoRespond: boolean): Promise<ConversationParticipant> => {
      if (!conversationId) throw new Error('No conversation selected');
      const updated = await api.patch<ConversationParticipant>(
        `/api/v1/conversations/${conversationId}/participants/${participantId}`,
        { autoRespond },
      );
      setParticipants((prev) =>
        prev.map((p) => (p.participantId === participantId ? { ...p, autoRespond } : p)),
      );
      return updated;
    },
    [conversationId],
  );

  const updateColor = useCallback(
    async (participantId: string, participantColor: string): Promise<ConversationParticipant> => {
      if (!conversationId) throw new Error('No conversation selected');
      const updated = await api.patch<ConversationParticipant>(
        `/api/v1/conversations/${conversationId}/participants/${participantId}`,
        { participantColor },
      );
      setParticipants((prev) =>
        prev.map((p) => (p.participantId === participantId ? { ...p, participantColor } : p)),
      );
      return updated;
    },
    [conversationId],
  );

  return {
    participants,
    loading,
    error,
    refetch: fetchParticipants,
    addParticipant,
    removeParticipant,
    toggleAutoRespond,
    updateColor,
  };
}
