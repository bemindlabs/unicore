'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen,
  Search,
  Upload,
  Trash2,
  FileText,
  Loader2,
  Clock,
  X,
  SlidersHorizontal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from '@unicore/ui';
import { api } from '@/lib/api';

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

function scoreColor(score: number): string {
  if (score >= 0.8) return 'text-emerald-600 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:bg-emerald-950';
  if (score >= 0.6) return 'text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-950';
  return 'text-rose-600 border-rose-300 bg-rose-50 dark:text-rose-400 dark:border-rose-700 dark:bg-rose-950';
}

function scoreDot(score: number): string {
  if (score >= 0.8) return 'bg-emerald-500';
  if (score >= 0.6) return 'bg-amber-500';
  return 'bg-rose-500';
}

/* ---------- Page ---------- */

export default function KnowledgeBasePage() {
  /* ---- Documents tab state ---- */
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
  const [showParams, setShowParams] = useState(false);
  const [searchParams, setSearchParams] = useState<SearchParams>({
    topK: 10,
    threshold: 0.5,
    workspaceId: 'default',
  });
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  /* ---------- Load search history ---------- */

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  /* Close history dropdown on outside click */
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
      const data = await api.get<unknown>(
        '/api/proxy/rag/ingest/info/default',
      );

      // Normalise: the RAG service may return { documents: [...] } or an array directly
      let docs: IngestedDocument[] = [];
      if (Array.isArray(data)) {
        docs = data as IngestedDocument[];
      } else if (
        data &&
        typeof data === 'object' &&
        'documents' in (data as Record<string, unknown>)
      ) {
        docs = (data as { documents: IngestedDocument[] }).documents ?? [];
      }

      setDocuments(docs);
    } catch (err) {
      setDocuments([]);
      toast({ title: 'Knowledge Base unavailable', description: 'RAG service may be down. Documents will appear when the service recovers.', variant: 'destructive' });
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  /* ---------- Ingest ---------- */

  async function handleIngest() {
    if (!ingestTitle.trim() || !ingestContent.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please provide both a title and content.',
        variant: 'destructive',
      });
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
      toast({ title: 'Document ingested', description: `"${ingestTitle}" has been added to the knowledge base.` });
      setIngestTitle('');
      setIngestContent('');
      setIngestType('text');
      await fetchDocuments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Ingestion failed',
        description: message,
        variant: 'destructive',
      });
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
      toast({
        title: 'Delete failed',
        description: message,
        variant: 'destructive',
      });
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

      // Normalise: response may be { results: [...] } or an array directly
      let results: SearchResult[] = [];
      if (Array.isArray(data)) {
        results = data as SearchResult[];
      } else if (
        data &&
        typeof data === 'object' &&
        'results' in (data as Record<string, unknown>)
      ) {
        results = (data as { results: SearchResult[] }).results ?? [];
      }

      // Apply client-side threshold filter if backend doesn't
      results = results.filter((r) => r.score >= searchParams.threshold);

      setSearchResults(results);
      setHistory((prev) => saveHistory(query, prev));

      if (results.length === 0) {
        toast({ title: 'No results', description: 'No matching documents found for this query.' });
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Ingest documents and search your organization&apos;s knowledge
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="w-full">
        <TabsList>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-2">
            <Search className="h-4 w-4" />
            Search
          </TabsTrigger>
        </TabsList>

        {/* ==================== Documents Tab ==================== */}
        <TabsContent value="documents" className="space-y-6 mt-4">
          {/* Upload section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4" />
                Ingest Document
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <Input
                  placeholder="Document title"
                  value={ingestTitle}
                  onChange={(e) => setIngestTitle(e.target.value)}
                />
                <Select value={ingestType} onValueChange={setIngestType}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder={
                  ingestType === 'url'
                    ? 'Paste URL here...'
                    : 'Paste content here...'
                }
                rows={5}
                value={ingestContent}
                onChange={(e) => setIngestContent(e.target.value)}
              />
              <div className="flex justify-end">
                <Button onClick={handleIngest} disabled={ingesting}>
                  {ingesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Ingesting...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Ingest
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Document list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Ingested Documents ({documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {docsLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">
                  Loading documents...
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  No documents ingested yet. Use the form above to add your
                  first document.
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between py-3 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium block truncate">
                            {doc.title}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-xs">
                              {doc.type}
                            </Badge>
                            {doc.chunkCount != null && (
                              <span className="text-xs text-muted-foreground">
                                {doc.chunkCount} chunks
                              </span>
                            )}
                            {doc.createdAt && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(doc.createdAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(doc.id)}
                        className="shrink-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== Search Tab ==================== */}
        <TabsContent value="search" className="space-y-4 mt-4">
          {/* Query form */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* Input row */}
              <form onSubmit={handleSearch}>
                <div className="flex gap-2">
                  <div className="relative flex-1" ref={historyRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Ask a question or search your knowledge base…"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      onFocus={() => history.length > 0 && setShowHistory(true)}
                      className="pl-9 pr-9"
                      autoComplete="off"
                    />
                    {searchText && (
                      <button
                        type="button"
                        onClick={() => { setSearchText(''); setShowHistory(false); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* History dropdown */}
                    {showHistory && history.length > 0 && (
                      <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-md">
                        <div className="flex items-center justify-between px-3 py-2 border-b">
                          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> Recent queries
                          </span>
                          <button
                            type="button"
                            onClick={clearHistory}
                            className="text-xs text-muted-foreground hover:text-destructive"
                          >
                            Clear
                          </button>
                        </div>
                        <ul>
                          {history.map((q, i) => (
                            <li key={i}>
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleSearch(e as unknown as React.FormEvent, q);
                                }}
                              >
                                <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{q}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowParams((p) => !p)}
                    title="Search parameters"
                    className={showParams ? 'border-primary text-primary' : ''}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                  <Button type="submit" disabled={searching || !searchText.trim()}>
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </>
                    )}
                  </Button>
                </div>

                {/* Advanced parameters panel */}
                {showParams && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-3 p-4 rounded-lg border bg-muted/40">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Top-K results</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={searchParams.topK}
                          onChange={(e) =>
                            setSearchParams((p) => ({
                              ...p,
                              topK: Math.max(1, Math.min(50, parseInt(e.target.value) || 10)),
                            }))
                          }
                          className="w-20 h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">1 – 50</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">
                        Min relevance threshold
                        <span className="ml-1 text-muted-foreground font-normal">
                          ({Math.round(searchParams.threshold * 100)}%)
                        </span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={searchParams.threshold}
                          onChange={(e) =>
                            setSearchParams((p) => ({
                              ...p,
                              threshold: parseFloat(e.target.value),
                            }))
                          }
                          className="flex-1 accent-primary"
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0%</span><span>100%</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Workspace</Label>
                      <Select
                        value={searchParams.workspaceId}
                        onValueChange={(v) =>
                          setSearchParams((p) => ({ ...p, workspaceId: v }))
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default workspace</SelectItem>
                          <SelectItem value="all">All workspaces</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </form>

              {/* Summary bar when results are shown */}
              {!searching && hasSearched && searchResults.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
                  <span>
                    <strong className="text-foreground">{searchResults.length}</strong> result{searchResults.length !== 1 ? 's' : ''} found
                  </span>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> ≥80%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> 60–79%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> &lt;60%
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Search results */}
          {searching ? (
            <div className="text-center py-12 text-muted-foreground text-sm animate-pulse">
              <Loader2 className="mx-auto h-6 w-6 mb-3 animate-spin opacity-50" />
              Searching knowledge base…
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-3">
              {searchResults.map((result, idx) => {
                const isExpanded = expandedIdx === idx;
                const docInList = documents.find(
                  (d) => d.id === result.documentId || d.title === result.documentTitle,
                );
                return (
                  <Card key={idx} className="overflow-hidden">
                    <CardContent className="pt-4 pb-3">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium truncate">
                            {result.documentTitle ?? 'Untitled document'}
                          </span>
                          {result.chunkIndex != null && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              chunk #{result.chunkIndex}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {result.score != null && (
                            <Badge
                              variant="outline"
                              className={`text-xs font-semibold flex items-center gap-1.5 ${scoreColor(result.score)}`}
                            >
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${scoreDot(result.score)}`} />
                              {(result.score * 100).toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Excerpt */}
                      <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-3'}`}>
                        {result.text}
                      </p>

                      {/* Footer: source attribution + expand */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {result.workspaceId && (
                            <span className="flex items-center gap-1">
                              Workspace: <strong className="text-foreground">{result.workspaceId}</strong>
                            </span>
                          )}
                          {docInList && (
                            <>
                              <span className="text-border">·</span>
                              <button
                                type="button"
                                className="flex items-center gap-1 hover:text-primary transition-colors"
                                onClick={() => {
                                  // Switch to documents tab and highlight
                                  (document.querySelector('[data-value="documents"]') as HTMLElement)?.click();
                                }}
                              >
                                <ExternalLink className="h-3 w-3" />
                                View in Documents
                              </button>
                            </>
                          )}
                          {result.documentId && (
                            <>
                              <span className="text-border">·</span>
                              <span className="font-mono opacity-60">{result.documentId.slice(0, 8)}…</span>
                            </>
                          )}
                        </div>
                        {result.text && result.text.length > 200 && (
                          <button
                            type="button"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                          >
                            {isExpanded ? (
                              <><ChevronUp className="h-3 w-3" /> Less</>
                            ) : (
                              <><ChevronDown className="h-3 w-3" /> More</>
                            )}
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : hasSearched ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Search className="mx-auto h-8 w-8 mb-2 opacity-40" />
              <p className="font-medium">No results found</p>
              <p className="mt-1 text-xs">Try lowering the relevance threshold or rephrasing your query.</p>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <BookOpen className="mx-auto h-8 w-8 mb-2 opacity-40" />
              <p className="font-medium">Search your knowledge base</p>
              <p className="mt-1 text-xs">Enter a natural language query above to find relevant document chunks.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
