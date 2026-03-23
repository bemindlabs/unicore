'use client';

import { RefreshCw, Brain, TrendingUp, Target, Tag } from 'lucide-react';
import { Badge, Button } from '@unicore/ui';
import type { ConversationIntelligence, Entity } from '@/hooks/use-intelligence-stream';

/* ------------------------------------------------------------------ */
/*  Sentiment helpers                                                  */
/* ------------------------------------------------------------------ */

function sentimentColor(s: 'positive' | 'neutral' | 'negative'): string {
  if (s === 'positive') return '#10b981';
  if (s === 'negative') return '#ef4444';
  return '#64748b';
}

function SentimentBadge({ sentiment }: { sentiment: 'positive' | 'neutral' | 'negative' }) {
  const color = sentimentColor(sentiment);
  const emoji = sentiment === 'positive' ? '😊' : sentiment === 'negative' ? '😞' : '😐';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
      style={{ background: color }}
    >
      {emoji} {sentiment}
    </span>
  );
}

function IntentBadge({ intent }: { intent: string }) {
  const colors: Record<string, string> = {
    question: '#3b82f6',
    request: '#8b5cf6',
    complaint: '#ef4444',
    confirmation: '#10b981',
    information: '#06b6d4',
    statement: '#64748b',
  };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white capitalize"
      style={{ background: colors[intent] ?? '#64748b' }}
    >
      {intent}
    </span>
  );
}

function EntityChip({ entity }: { entity: Entity }) {
  const typeColors: Record<string, string> = {
    email: '#f59e0b',
    url: '#3b82f6',
    mention: '#8b5cf6',
    amount: '#10b981',
    date: '#06b6d4',
    keyword: '#64748b',
  };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white truncate max-w-[120px]"
      style={{ background: typeColors[entity.type] ?? '#64748b' }}
      title={`${entity.type}: ${entity.value}`}
    >
      {entity.value}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main sidebar                                                       */
/* ------------------------------------------------------------------ */

interface Props {
  intelligence: ConversationIntelligence | null;
  loading: boolean;
  onRefresh: () => void;
}

export function ConversationIntelligenceSidebar({ intelligence, loading, onRefresh }: Props) {
  if (loading && !intelligence) {
    return (
      <div className="rounded-xl border bg-card/50 p-4 space-y-3 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-3/4 bg-muted rounded" />
        <div className="h-3 w-1/2 bg-muted rounded" />
      </div>
    );
  }

  if (!intelligence) {
    return (
      <div className="rounded-xl border bg-card/50 p-4 text-center space-y-2">
        <Brain className="h-6 w-6 text-muted-foreground/40 mx-auto" />
        <p className="text-xs text-muted-foreground">No AI analysis yet</p>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onRefresh}>
          <RefreshCw className="h-3 w-3" />
          Analyze
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/10">
        <div className="flex items-center gap-1.5 font-semibold text-xs">
          <Brain className="h-3.5 w-3.5 text-primary" />
          AI Intelligence
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          onClick={onRefresh}
          title="Re-analyze"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary */}
        <div>
          <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            <Brain className="h-3 w-3" /> Summary
          </p>
          <p className="text-xs text-foreground leading-relaxed">{intelligence.aiSummary}</p>
        </div>

        {/* Overall Sentiment */}
        <div>
          <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Sentiment
          </p>
          <SentimentBadge sentiment={intelligence.sentimentOverall} />
          {intelligence.messageSentiments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {intelligence.messageSentiments.slice(0, 6).map((ms) => (
                <span
                  key={ms.messageId}
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ background: sentimentColor(ms.sentiment) }}
                  title={`${ms.sentiment} (score: ${ms.score})`}
                />
              ))}
              {intelligence.messageSentiments.length > 6 && (
                <span className="text-[9px] text-muted-foreground">+{intelligence.messageSentiments.length - 6}</span>
              )}
            </div>
          )}
        </div>

        {/* Intent History */}
        {intelligence.intentHistory.length > 0 && (
          <div>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
              <Target className="h-3 w-3" /> Intents
            </p>
            <div className="flex flex-wrap gap-1">
              {/* Deduplicated intents */}
              {Array.from(new Set(intelligence.intentHistory.map((i) => i.intent))).map((intent) => (
                <IntentBadge key={intent} intent={intent} />
              ))}
            </div>
          </div>
        )}

        {/* Key Entities */}
        {intelligence.keyEntities.length > 0 && (
          <div>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
              <Tag className="h-3 w-3" /> Entities
            </p>
            <div className="flex flex-wrap gap-1">
              {intelligence.keyEntities.slice(0, 8).map((entity, i) => (
                <EntityChip key={i} entity={entity} />
              ))}
              {intelligence.keyEntities.length > 8 && (
                <span className="text-[9px] text-muted-foreground self-center">+{intelligence.keyEntities.length - 8} more</span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-[9px] text-muted-foreground/50 pt-1 border-t">
          Analyzed {new Date(intelligence.analyzedAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
