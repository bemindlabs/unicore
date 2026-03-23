'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface MessageSentiment {
  messageId: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
}

export interface IntentEntry {
  messageId: string;
  intent: string;
  confidence: number;
}

export interface Entity {
  value: string;
  type: 'email' | 'url' | 'mention' | 'amount' | 'keyword' | 'date';
}

export interface ConversationIntelligence {
  chatHistoryId: string;
  aiSummary: string;
  sentimentOverall: 'positive' | 'neutral' | 'negative';
  messageSentiments: MessageSentiment[];
  intentHistory: IntentEntry[];
  keyEntities: Entity[];
  analyzedAt: string;
}

export function useIntelligenceStream(
  chatHistoryId: string | null,
  token: string | null,
): {
  intelligence: ConversationIntelligence | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [intelligence, setIntelligence] = useState<ConversationIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAndStream = useCallback(async () => {
    if (!chatHistoryId || !token) return;

    setLoading(true);
    setError(null);

    // Fetch existing intelligence
    try {
      abortRef.current = new AbortController();
      const res = await fetch(`/api/v1/chat-history/${chatHistoryId}/intelligence`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortRef.current.signal,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.analyzed !== false) {
          setIntelligence(data as ConversationIntelligence);
        } else {
          // Trigger analysis
          await fetch(`/api/v1/chat-history/${chatHistoryId}/intelligence/analyze`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }
    } catch {
      // ignore abort errors
    } finally {
      setLoading(false);
    }

    // Open SSE stream for live updates
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    const apiBase = typeof window !== 'undefined' ? window.location.origin : '';
    const es = new EventSource(
      `${apiBase}/api/v1/chat-history/${chatHistoryId}/intelligence/stream?token=${encodeURIComponent(token ?? '')}`,
    );
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ConversationIntelligence;
        setIntelligence(data);
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
    };
  }, [chatHistoryId, token]);

  const refresh = useCallback(() => {
    if (!chatHistoryId || !token) return;
    fetch(`/api/v1/chat-history/${chatHistoryId}/intelligence/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => { /* ignore */ });
  }, [chatHistoryId, token]);

  useEffect(() => {
    fetchAndStream();
    return () => {
      abortRef.current?.abort();
      esRef.current?.close();
      esRef.current = null;
    };
  }, [fetchAndStream]);

  return { intelligence, loading, error, refresh };
}
