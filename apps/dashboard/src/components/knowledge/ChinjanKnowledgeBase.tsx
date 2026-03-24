'use client';

// UNC-173: ChinjanKnowledgeBase wrapper component
// UNC-174: Pixel-art borders and fonts applied to document list
// UNC-175: Pixel-art search result cards
// UNC-176: PixelStar decorations for ingested documents

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from '@bemindlabs/unicore-ui';
import { api } from '@/lib/api';
import { PixelStar } from '@/components/backoffice/retrodesk/PixelDecorations';

/* ---------- Types ---------- */

interface IngestedDocument {
  id: string;
  title: string;
  type: string;
  chunkCount: number;
  createdAt: string;
}

interface SearchResult {
  documentTitle: string;
  documentId?: string;
  score: number;
  text: string;
  chunkIndex?: number;
  workspaceId?: string;
}

interface SearchParams {
  topK: number;
  threshold: number;
  workspaceId: string;
}

const HISTORY_KEY = 'kb_search_history';
const MAX_HISTORY = 10;

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveHistory(query: string, prev: string[]): string[] {
  const next = [query, ...prev.filter((q) => q !== query)].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

/* ---------- Pixel score badge ---------- */

function PixelScoreBadge({ score }: { score: number }) {
  let color = '#6ee7b7'; // green
  if (score < 0.8 && score >= 0.6) color = '#fcd34d'; // yellow
  if (score < 0.6) color = '#f87171'; // red

  return (
    <span
      className="retrodesk-mono text-xs px-2 py-0.5 border-2"
      style={{
        borderColor: color,
        color,
        background: 'transparent',
        fontFamily: 'VT323, monospace',
        fontSize: '1rem',
      }}
    >
      {(score * 100).toFixed(0)}% MATCH
    </span>
  );
}

/* ---------- Pixel loading dots ---------- */

function PixelLoadingDots({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-3 h-3"
            style={{
              background: 'var(--retrodesk-pink)',
              animation: `pixelBounce 1s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <span className="retrodesk-mono" style={{ color: 'var(--retrodesk-muted)', fontSize: '1.1rem' }}>
        {label}
      </span>
    </div>
  );
}

/* ---------- Main Component ---------- */

export function ChinjanKnowledgeBase() {
  /* ---- Documents tab state ---- */
  const [activeTab, setActiveTab] = useState<'documents' | 'search'>('documents');
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  const [ingestTitle, setIngestTitle] = useState('');
  const [ingestContent, setIngestContent] = useState('');
  const [ingestType, setIngestType] = useState<string>('text');
  const [ingesting, setIngesting] = useState(false);

  /* ---- Search tab state ---- */
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [searchParams] = useState<SearchParams>({ topK: 10, threshold: 0.5, workspaceId: 'default' });
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHistory(loadHistory()); }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ---------- Fetch documents ---------- */

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await api.get<unknown>('/api/proxy/rag/ingest/info/default');
      let docs: IngestedDocument[] = [];
      if (Array.isArray(data)) {
        docs = data as IngestedDocument[];
      } else if (data && typeof data === 'object' && 'documents' in (data as Record<string, unknown>)) {
        docs = (data as { documents: IngestedDocument[] }).documents ?? [];
      }
      setDocuments(docs);
    } catch {
      setDocuments([]);
      toast({ title: 'Knowledge Base unavailable', description: 'RAG service may be down.', variant: 'destructive' });
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  /* ---------- Ingest ---------- */

  async function handleIngest() {
    if (!ingestTitle.trim() || !ingestContent.trim()) {
      toast({ title: 'Missing fields', description: 'Please provide both a title and content.', variant: 'destructive' });
      return;
    }
    setIngesting(true);
    try {
      await api.post('/api/proxy/rag/ingest', {
        title: ingestTitle.trim(),
        content: ingestContent.trim(),
        type: ingestType,
        workspaceId: 'default',
      });
      toast({ title: '★ Document ingested!', description: `"${ingestTitle}" added to knowledge base.` });
      setIngestTitle('');
      setIngestContent('');
      setIngestType('text');
      await fetchDocuments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Ingestion failed', description: message, variant: 'destructive' });
    } finally {
      setIngesting(false);
    }
  }

  /* ---------- Delete ---------- */

  async function handleDelete(docId: string) {
    try {
      await api.delete(`/api/proxy/rag/ingest/${docId}`);
      toast({ title: 'Document deleted' });
      await fetchDocuments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Delete failed', description: message, variant: 'destructive' });
    }
  }

  /* ---------- Search ---------- */

  async function handleSearch(e: React.FormEvent, overrideQuery?: string) {
    e.preventDefault();
    const query = (overrideQuery ?? searchText).trim();
    if (!query) return;
    if (overrideQuery) setSearchText(overrideQuery);
    setShowHistory(false);
    setSearching(true);
    setHasSearched(true);
    setExpandedIdx(null);
    try {
      const data = await api.post<unknown>('/api/proxy/rag/query', {
        query,
        workspaceId: searchParams.workspaceId,
        topK: searchParams.topK,
        threshold: searchParams.threshold,
      });
      let results: SearchResult[] = [];
      if (Array.isArray(data)) {
        results = data as SearchResult[];
      } else if (data && typeof data === 'object' && 'results' in (data as Record<string, unknown>)) {
        results = (data as { results: SearchResult[] }).results ?? [];
      }
      results = results.filter((r) => r.score >= searchParams.threshold);
      setSearchResults(results);
      setHistory((prev) => saveHistory(query, prev));
      if (results.length === 0) {
        toast({ title: 'No results', description: 'No matching documents found.' });
      }
    } catch (err) {
      toast({ title: 'Search failed', description: err instanceof Error ? err.message : 'RAG service unavailable', variant: 'destructive' });
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
    setShowHistory(false);
  }

  /* ---------- Render ---------- */

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <div className="flex gap-2 items-center">
          <PixelStar px={4} />
          <PixelStar px={3} className="mt-2" />
        </div>
        <div>
          <h1
            className="retrodesk-heading text-sm leading-relaxed"
            style={{ color: 'var(--retrodesk-pink)' }}
          >
            KNOWLEDGE BASE
          </h1>
          <p className="retrodesk-mono mt-1" style={{ color: 'var(--retrodesk-muted)', fontSize: '1.1rem' }}>
            Ingest documents &amp; search your org&apos;s knowledge
          </p>
        </div>
        <div className="flex gap-2 ml-auto items-end">
          <PixelStar px={3} className="mb-1" />
          <PixelStar px={4} />
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div
        className="flex border-2"
        style={{ borderColor: 'var(--retrodesk-border)' }}
      >
        {(['documents', 'search'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="retrodesk-mono px-6 py-2 border-r-2 last:border-r-0 transition-colors"
            style={{
              borderColor: 'var(--retrodesk-border)',
              background: activeTab === tab ? 'var(--retrodesk-pink)' : 'var(--retrodesk-surface)',
              color: activeTab === tab ? '#fff' : 'var(--retrodesk-text)',
              fontSize: '1.1rem',
              letterSpacing: '0.05em',
            }}
          >
            {tab === 'documents' ? '★ DOCUMENTS' : '♦ SEARCH'}
          </button>
        ))}
      </div>

      {/* ==================== Documents Tab ==================== */}
      {activeTab === 'documents' && (
        <div className="space-y-6">

          {/* UNC-174: Ingest form with pixel-art borders and fonts */}
          <div
            className="retrodesk-pixel-border p-4 space-y-4"
            style={{ background: 'var(--retrodesk-surface)' }}
          >
            <h2
              className="retrodesk-heading text-xs"
              style={{ color: 'var(--retrodesk-blue)' }}
            >
              ▶ INGEST DOCUMENT
            </h2>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <input
                className="retrodesk-mono border-2 px-3 py-2 w-full"
                style={{
                  borderColor: 'var(--retrodesk-border)',
                  background: 'var(--retrodesk-bg)',
                  color: 'var(--retrodesk-text)',
                  outline: 'none',
                  fontSize: '1.1rem',
                }}
                placeholder="Document title"
                value={ingestTitle}
                onChange={(e) => setIngestTitle(e.target.value)}
              />
              <Select value={ingestType} onValueChange={setIngestType}>
                <SelectTrigger
                  className="retrodesk-mono border-2 w-[130px]"
                  style={{
                    borderColor: 'var(--retrodesk-border)',
                    background: 'var(--retrodesk-bg)',
                    color: 'var(--retrodesk-text)',
                    borderRadius: 0,
                    fontSize: '1.1rem',
                  }}
                >
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <textarea
              className="retrodesk-mono border-2 px-3 py-2 w-full resize-none"
              style={{
                borderColor: 'var(--retrodesk-border)',
                background: 'var(--retrodesk-bg)',
                color: 'var(--retrodesk-text)',
                outline: 'none',
                fontSize: '1.1rem',
              }}
              placeholder={ingestType === 'url' ? 'Paste URL here...' : 'Paste content here...'}
              rows={5}
              value={ingestContent}
              onChange={(e) => setIngestContent(e.target.value)}
            />

            <div className="flex justify-end">
              <button
                onClick={handleIngest}
                disabled={ingesting}
                className="retrodesk-mono px-5 py-2 border-2 transition-colors disabled:opacity-50"
                style={{
                  borderColor: 'var(--retrodesk-pink)',
                  color: ingesting ? 'var(--retrodesk-muted)' : '#fff',
                  background: ingesting ? 'var(--retrodesk-surface)' : 'var(--retrodesk-pink)',
                  fontSize: '1.1rem',
                  cursor: ingesting ? 'not-allowed' : 'pointer',
                }}
              >
                {ingesting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> INGESTING...
                  </span>
                ) : (
                  '▶ INGEST'
                )}
              </button>
            </div>
          </div>

          {/* UNC-174 + UNC-176: Document list with pixel borders and PixelStar decorations */}
          <div
            className="retrodesk-pixel-border"
            style={{ background: 'var(--retrodesk-surface)' }}
          >
            <div
              className="px-4 py-3 border-b-2 flex items-center justify-between"
              style={{ borderColor: 'var(--retrodesk-border)' }}
            >
              <span
                className="retrodesk-heading text-xs"
                style={{ color: 'var(--retrodesk-text)' }}
              >
                INGESTED DOCS ({documents.length})
              </span>
            </div>

            <div className="p-4">
              {docsLoading ? (
                <PixelLoadingDots label="LOADING DOCUMENTS..." />
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10">
                  <PixelStar px={4} />
                  <span className="retrodesk-mono" style={{ color: 'var(--retrodesk-muted)', fontSize: '1.1rem' }}>
                    No documents yet. Ingest your first one!
                  </span>
                </div>
              ) : (
                <div className="space-y-0">
                  {documents.map((doc, idx) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between py-3 border-b-2 last:border-b-0"
                      style={{ borderColor: 'var(--retrodesk-border)' }}
                    >
                      {/* UNC-176: PixelStar decoration for each ingested document */}
                      <div className="flex items-center gap-3 min-w-0">
                        <PixelStar
                          px={idx % 2 === 0 ? 3 : 2}
                          className="shrink-0"
                        />
                        <div className="min-w-0">
                          <span
                            className="retrodesk-mono text-sm block truncate"
                            style={{ color: 'var(--retrodesk-text)', fontSize: '1rem' }}
                          >
                            {doc.title}
                          </span>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span
                              className="retrodesk-mono border px-1 text-xs"
                              style={{
                                borderColor: 'var(--retrodesk-blue)',
                                color: 'var(--retrodesk-blue)',
                                fontSize: '0.85rem',
                              }}
                            >
                              {doc.type.toUpperCase()}
                            </span>
                            {doc.chunkCount != null && (
                              <span className="retrodesk-mono" style={{ color: 'var(--retrodesk-muted)', fontSize: '0.9rem' }}>
                                {doc.chunkCount} chunks
                              </span>
                            )}
                            {doc.createdAt && (
                              <span className="retrodesk-mono" style={{ color: 'var(--retrodesk-muted)', fontSize: '0.9rem' }}>
                                {new Date(doc.createdAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="retrodesk-mono shrink-0 border-2 px-2 py-1 ml-3 transition-colors hover:border-red-400"
                        style={{
                          borderColor: 'var(--retrodesk-border)',
                          color: 'var(--retrodesk-muted)',
                          background: 'transparent',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                        }}
                        title="Delete document"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== Search Tab ==================== */}
      {activeTab === 'search' && (
        <div className="space-y-6">

          {/* Search form */}
          <div
            className="retrodesk-pixel-border p-4"
            style={{ background: 'var(--retrodesk-surface)' }}
          >
            <div ref={historyRef} className="relative">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  className="retrodesk-mono border-2 px-3 py-2 flex-1"
                  style={{
                    borderColor: 'var(--retrodesk-border)',
                    background: 'var(--retrodesk-bg)',
                    color: 'var(--retrodesk-text)',
                    outline: 'none',
                    fontSize: '1.1rem',
                  }}
                  placeholder="Search Knowledge Base..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onFocus={() => history.length > 0 && setShowHistory(true)}
                />
                <button
                  type="submit"
                  disabled={searching || !searchText.trim()}
                  className="retrodesk-mono border-2 px-4 py-2 transition-colors disabled:opacity-50"
                  style={{
                    borderColor: 'var(--retrodesk-blue)',
                    color: '#fff',
                    background: searching || !searchText.trim() ? 'var(--retrodesk-muted)' : 'var(--retrodesk-blue)',
                    fontSize: '1.1rem',
                    cursor: searching || !searchText.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : '♦ SEARCH'}
                </button>
              </form>

              {/* Search history dropdown */}
              {showHistory && history.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 z-10 border-2 border-t-0"
                  style={{
                    borderColor: 'var(--retrodesk-border)',
                    background: 'var(--retrodesk-surface)',
                  }}
                >
                  {history.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className="retrodesk-mono w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-opacity-50 transition-colors"
                      style={{
                        borderColor: 'var(--retrodesk-border)',
                        color: 'var(--retrodesk-text)',
                        background: 'transparent',
                        fontSize: '1rem',
                        cursor: 'pointer',
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSearch(e as unknown as React.FormEvent, q);
                      }}
                    >
                      ▸ {q}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="retrodesk-mono w-full text-left px-3 py-1.5 transition-colors"
                    style={{ color: 'var(--retrodesk-muted)', background: 'transparent', fontSize: '0.9rem', cursor: 'pointer' }}
                    onMouseDown={(e) => { e.preventDefault(); clearHistory(); }}
                  >
                    ✕ Clear history
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* UNC-175: Pixel-art search result cards */}
          {searching ? (
            <PixelLoadingDots label="SEARCHING..." />
          ) : searchResults.length > 0 ? (
            <div className="space-y-3">
              {searchResults.map((result, idx) => (
                <div
                  key={idx}
                  className="retrodesk-pixel-border p-4 cursor-pointer transition-all"
                  style={{
                    background: 'var(--retrodesk-surface)',
                    borderColor: expandedIdx === idx ? 'var(--retrodesk-pink)' : 'var(--retrodesk-border)',
                  }}
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <PixelStar px={2} className="shrink-0 mt-0.5" />
                      <span
                        className="retrodesk-mono font-medium truncate"
                        style={{ color: 'var(--retrodesk-text)', fontSize: '1rem' }}
                      >
                        {result.documentTitle ?? 'Untitled'}
                      </span>
                    </div>
                    {result.score != null && (
                      <PixelScoreBadge score={result.score} />
                    )}
                  </div>

                  {/* Snippet */}
                  <p
                    className="retrodesk-mono mt-2 leading-relaxed"
                    style={{
                      color: 'var(--retrodesk-muted)',
                      fontSize: '1rem',
                      display: '-webkit-box',
                      WebkitLineClamp: expandedIdx === idx ? undefined : 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: expandedIdx === idx ? 'visible' : 'hidden',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {result.text}
                  </p>

                  {result.text && result.text.length > 200 && (
                    <span
                      className="retrodesk-mono text-xs mt-1 block"
                      style={{ color: 'var(--retrodesk-pink)' }}
                    >
                      {expandedIdx === idx ? '▲ COLLAPSE' : '▼ EXPAND'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : hasSearched ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <PixelStar px={4} />
              <span className="retrodesk-mono" style={{ color: 'var(--retrodesk-muted)', fontSize: '1.1rem' }}>
                No results found. Try a different query.
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10">
              <PixelStar px={5} />
              <span className="retrodesk-mono" style={{ color: 'var(--retrodesk-muted)', fontSize: '1.1rem' }}>
                Enter a query above to search the knowledge base.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
