'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Badge,
} from '@unicore/ui';
import { Layers, Loader2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';

interface Chunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex?: number;
  metadata?: {
    chunkIndex?: number;
    totalChunks?: number;
    startChar?: number;
    endChar?: number;
    [key: string]: unknown;
  };
  score?: number;
  text?: string;
}

interface DocumentChunkViewerProps {
  documentId: string;
  documentTitle: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentChunkViewer({
  documentId,
  documentTitle,
  workspaceId,
  open,
  onOpenChange,
}: DocumentChunkViewerProps) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setChunks([]);
    setError(null);
    setExpandedIdx(null);
    setLoading(true);

    api
      .get<unknown>(`/api/proxy/rag/query/document/${workspaceId}/${documentId}`)
      .then((data) => {
        let result: Chunk[] = [];
        if (Array.isArray(data)) {
          result = data as Chunk[];
        } else if (data && typeof data === 'object') {
          const obj = data as Record<string, unknown>;
          if (Array.isArray(obj.chunks)) result = obj.chunks as Chunk[];
          else if (Array.isArray(obj.results)) result = obj.results as Chunk[];
        }
        // Sort by chunkIndex if available
        result.sort((a, b) => {
          const ai = a.metadata?.chunkIndex ?? a.chunkIndex ?? 0;
          const bi = b.metadata?.chunkIndex ?? b.chunkIndex ?? 0;
          return ai - bi;
        });
        setChunks(result);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load chunks');
      })
      .finally(() => setLoading(false));
  }, [open, documentId, workspaceId]);

  function chunkText(chunk: Chunk): string {
    return chunk.content ?? chunk.text ?? '';
  }

  function chunkIndex(chunk: Chunk): number {
    return chunk.metadata?.chunkIndex ?? chunk.chunkIndex ?? 0;
  }

  function totalChunks(chunk: Chunk): number | undefined {
    return chunk.metadata?.totalChunks;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            Chunks — {documentTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading chunks...
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && chunks.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Layers className="mx-auto h-8 w-8 mb-2 opacity-40" />
              No chunks found for this document.
            </div>
          )}

          {!loading &&
            chunks.map((chunk, idx) => {
              const ci = chunkIndex(chunk);
              const tc = totalChunks(chunk);
              const text = chunkText(chunk);
              const isExpanded = expandedIdx === idx;
              const preview = text.length > 200 ? text.slice(0, 200) + '…' : text;

              return (
                <div
                  key={chunk.id ?? idx}
                  className="rounded-md border bg-card p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">
                        #{ci + 1}
                        {tc != null ? ` / ${tc}` : ''}
                      </Badge>
                      {chunk.metadata?.startChar != null && chunk.metadata?.endChar != null && (
                        <span className="text-xs text-muted-foreground">
                          chars {chunk.metadata.startChar}–{chunk.metadata.endChar}
                        </span>
                      )}
                    </div>
                    {text.length > 200 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                      >
                        {isExpanded ? (
                          <><ChevronUp className="h-3 w-3 mr-1" />Less</>
                        ) : (
                          <><ChevronDown className="h-3 w-3 mr-1" />More</>
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {isExpanded ? text : preview}
                  </p>
                </div>
              );
            })}
        </div>

        <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>{chunks.length} chunk{chunks.length !== 1 ? 's' : ''}</span>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
