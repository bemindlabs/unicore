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
  Link,
  AlignLeft,
  FileArchive,
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
} from '@bemindlabs/unicore-ui';
import { api } from '@/lib/api';
import { FileUploadInput } from '@/components/file-upload-input';

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
  if (score >= 0.8)
    return 'text-emerald-600 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:bg-emerald-950';
  if (score >= 0.6)
    return 'text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-950';
  return 'text-rose-600 border-rose-300 bg-rose-50 dark:text-rose-400 dark:border-rose-700 dark:bg-rose-950';
}

function scoreDot(score: number): string {
  if (score >= 0.8) return 'bg-emerald-500';
  if (score >= 0.6) return 'bg-amber-500';
  return 'bg-rose-500';
}

function typeVariant(type: string): { label: string; className: string; Icon: React.ElementType } {
  switch (type?.toLowerCase()) {
    case 'url':
      return {
        label: 'URL',
        className:
          'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
        Icon: Link,
      };
    case 'pdf':
      return {
        label: 'PDF',
        className:
          'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
        Icon: FileArchive,
      };
    default:
      return {
        label: 'Text',
        className:
          'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800',
        Icon: AlignLeft,
      };
  }
}

/* ---------- Sub-components ---------- */

function DocSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3 border-b last:border-0 animate-pulse">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-4 w-4 rounded bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-48 rounded bg-muted" />
              <div className="flex gap-2">
                <div className="h-3 w-12 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted" />
              </div>
            </div>
          </div>
          <div className="h-8 w-8 rounded bg-muted shrink-0" />
        </div>
      ))}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={"h-full rounded-full " + scoreDot(score)}
          style={{ width: pct + "%" }}
        />
      </div>
      <span>{pct}%</span>
    </div>
  );
}

/* ---------- Page ---------- */

export default function KnowledgeBasePage() {
  /* ---- Documents tab state ---- */
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const [ingestTitle, setIngestTitle] = useState('');
  const [ingestContent, setIngestContent] = useState('');
  const [ingestType, setIngestType] = useState<string>('text');
  const [ingesting, setIngesting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const [processing, setProcessing] = useState(false);

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

  /* Load search history on mount */
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  /* Close history dropdown on outside click */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    }
    if (showHistory) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory]);

  /* ---------- Fetch documents ---------- */

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await api.get<unknown>('/api/proxy/rag/info');

      let docs: IngestedDocument[] = [];
      if (Array.isArray(data)) {
        docs = data as IngestedDocument[];
      } else if (data && typeof data === 'object' && 'documents' in (data as Record<string, unknown>)) {
        docs = (data as { documents: IngestedDocument[] }).documents ?? [];
      }

      setDocuments(docs);
    } catch {
      setDocuments([]);
      toast({
        title: 'Knowledge Base unavailable',
        description: 'RAG service may be down. Documents will appear when the service recovers.',
        variant: 'destructive',
      });
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  /* ---------- Ingest ---------- */

  async function handleIngest() {
    if (!ingestTitle.trim()) {
      toast({ title: 'Missing title', description: 'Please provide a document title.', variant: 'destructive' });
      return;
    }

    if (ingestType === 'pdf') {
      if (!selectedFile) {
        toast({ title: 'No file selected', description: 'Please select a PDF file to upload.', variant: 'destructive' });
        return;
      }
      setIngesting(true);
      setUploadProgress(0);
      setProcessing(false);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('title', ingestTitle.trim());
        formData.append('type', 'pdf');
        formData.append('workspaceId', 'default');
        await api.uploadFile('/api/proxy/rag/ingest/upload', formData, (pct) => {
          setUploadProgress(pct);
          if (pct === 100) setProcessing(true);
        });
        toast({ title: 'PDF ingested', description: '"' + ingestTitle + '" has been added to the knowledge base.' });
        setIngestTitle('');
        setSelectedFile(null);
        setIngestType('text');
        setUploadProgress(undefined);
        setProcessing(false);
        await fetchDocuments();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast({ title: 'Upload failed', description: message, variant: 'destructive' });
        setUploadProgress(undefined);
        setProcessing(false);
      } finally {
        setIngesting(false);
      }
      return;
    }

    if (!ingestContent.trim()) {
      toast({ title: 'Missing content', description: 'Please provide document content.', variant: 'destructive' });
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
      toast({ title: 'Document ingested', description: '"' + ingestTitle + '" has been added to the knowledge base.' });
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
    setDeletingIds((prev) => new Set(prev).add(docId));
    try {
      await api.delete('/api/proxy/rag/ingest/' + docId);
      toast({ title: 'Document deleted' });
      await fetchDocuments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Delete failed', description: message, variant: 'destructive' });
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  }

  /* ---------- Search ---------- */

  async function handleSearch(queryOverride?: string) {
    const query = (queryOverride ?? searchText).trim();
    if (!query) return;

    setSearchText(query);
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

      setSearchResults(results);
      setHistory((prev) => saveHistory(query, prev));

      if (results.length === 0) {
        toast({ title: 'No results', description: 'No matching documents found.' });
      }
    } catch (err) {
      toast({
        title: 'Search failed',
        description: err instanceof Error ? err.message : 'RAG service unavailable',
        variant: 'destructive',
      });
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
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
            {documents.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 h-4">
                {documents.length}
              </Badge>
            )}
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
                <div className="space-y-1.5">
                  <Label htmlFor="ingest-title">Title</Label>
                  <Input
                    id="ingest-title"
                    placeholder="e.g. Company Onboarding Guide"
                    value={ingestTitle}
                    onChange={(e) => setIngestTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={ingestType}
                    onValueChange={(v) => {
                      setIngestType(v);
                      setSelectedFile(null);
                      setUploadProgress(undefined);
                      setProcessing(false);
                    }}
                    disabled={ingesting}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">
                        <span className="flex items-center gap-2">
                          <AlignLeft className="h-3.5 w-3.5" /> Text
                        </span>
                      </SelectItem>
                      <SelectItem value="url">
                        <span className="flex items-center gap-2">
                          <Link className="h-3.5 w-3.5" /> URL
                        </span>
                      </SelectItem>
                      <SelectItem value="pdf">
                        <span className="flex items-center gap-2">
                          <FileArchive className="h-3.5 w-3.5" /> PDF
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {ingestType === 'pdf' ? (
                <FileUploadInput
                  selectedFile={selectedFile}
                  onFileSelect={setSelectedFile}
                  progress={uploadProgress}
                  processing={processing}
                />
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="ingest-content">
                    {ingestType === 'url' ? 'URL' : 'Content'}
                  </Label>
                  <Textarea
                    id="ingest-content"
                    placeholder={
                      ingestType === 'url'
                        ? 'https://example.com/page-to-ingest'
                        : 'Paste or type the document content here...'
                    }
                    rows={5}
                    value={ingestContent}
                    onChange={(e) => setIngestContent(e.target.value)}
                    disabled={ingesting}
                  />
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  onClick={handleIngest}
                  disabled={
                    ingesting ||
                    !ingestTitle.trim() ||
                    (ingestType === 'pdf' ? !selectedFile : !ingestContent.trim())
                  }
                >
                  {ingesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {ingestType === 'pdf' && processing ? 'Processing...' : 'Uploading...'}
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {ingestType === 'pdf' ? 'Upload PDF' : 'Ingest'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Document list */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Ingested Documents</CardTitle>
              {documents.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {documents.length} document{documents.length !== 1 ? 's' : ''}
                </span>
              )}
            </CardHeader>
            <CardContent>
              {docsLoading ? (
                <DocSkeleton />
              ) : documents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                    <FileText className="h-7 w-7 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No documents yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Use the form above to ingest your first document.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {documents.map((doc) => {
                    const tv = typeVariant(doc.type);
                    const isDeleting = deletingIds.has(doc.id);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between py-3 border-b last:border-0 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <tv.Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <span className="text-sm font-medium block truncate">{doc.title}</span>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span
                                className={"inline-flex items-center rounded-md border px-1.5 py-0 text-xs font-medium " + tv.className}
                              >
                                {tv.label}
                              </span>
                              {doc.chunkCount != null && (
                                <span className="text-xs text-muted-foreground">
                                  {doc.chunkCount} chunk{doc.chunkCount !== 1 ? 's' : ''}
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
                          disabled={isDeleting}
                          className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={"Delete " + doc.title}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== Search Tab ==================== */}
        <TabsContent value="search" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* Search bar row */}
              <div className="relative" ref={historyRef}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearch();
                  }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Ask the knowledge base anything..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      onFocus={() => history.length > 0 && setShowHistory(true)}
                      className="pl-9"
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
                  </div>
                  <Button type="submit" disabled={searching || !searchText.trim()}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant={showParams ? 'secondary' : 'outline'}
                    size="icon"
                    onClick={() => setShowParams((v) => !v)}
                    aria-label="Search parameters"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </form>

                {/* Search history dropdown */}
                {showHistory && history.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full rounded-md border bg-popover shadow-md">
                    <div className="px-3 py-2 text-xs font-medium text-muted-foreground flex items-center gap-1.5 border-b">
                      <Clock className="h-3.5 w-3.5" />
                      Recent searches
                    </div>
                    {history.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
                        onClick={() => handleSearch(q)}
                      >
                        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{q}</span>
                      </button>
                    ))}
                    <div className="px-3 py-1.5 border-t">
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => {
                          localStorage.removeItem(HISTORY_KEY);
                          setHistory([]);
                          setShowHistory(false);
                        }}
                      >
                        Clear history
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced params panel */}
              {showParams && (
                <div className="rounded-lg border bg-muted/40 p-4 grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Top K results</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={searchParams.topK}
                      onChange={(e) =>
                        setSearchParams((p) => ({ ...p, topK: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Min relevance (0-1)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={searchParams.threshold}
                      onChange={(e) =>
                        setSearchParams((p) => ({ ...p, threshold: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Workspace ID</Label>
                    <Input
                      value={searchParams.workspaceId}
                      onChange={(e) =>
                        setSearchParams((p) => ({ ...p, workspaceId: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Search results */}
          {searching ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-48 rounded bg-muted" />
                      <div className="h-4 w-16 rounded bg-muted" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-3 w-full rounded bg-muted" />
                      <div className="h-3 w-4/5 rounded bg-muted" />
                      <div className="h-3 w-3/5 rounded bg-muted" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground px-1">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </p>
              {searchResults.map((result, idx) => {
                const isExpanded = expandedIdx === idx;
                return (
                  <Card key={idx} className="overflow-hidden">
                    <CardContent className="pt-4 pb-0">
                      {/* Result header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium truncate">
                            {result.documentTitle ?? 'Untitled'}
                          </span>
                          {result.chunkIndex != null && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              chunk {result.chunkIndex}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {result.score != null && (
                            <span
                              className={"inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium " + scoreColor(result.score)}
                            >
                              <span className={"h-1.5 w-1.5 rounded-full " + scoreDot(result.score)} />
                              {(result.score * 100).toFixed(1)}%
                            </span>
                          )}
                          {result.documentId && (
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="View source document"
                              onClick={() =>
                                toast({
                                  title: 'Source',
                                  description: 'Document ID: ' + result.documentId,
                                })
                              }
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Score bar */}
                      {result.score != null && (
                        <div className="mb-3">
                          <ScoreBar score={result.score} />
                        </div>
                      )}

                      {/* Excerpt */}
                      <p
                        className={"text-sm text-muted-foreground whitespace-pre-wrap " + (isExpanded ? '' : 'line-clamp-3')}
                      >
                        {result.text}
                      </p>
                    </CardContent>

                    {/* Expand toggle */}
                    {result.text && result.text.length > 200 ? (
                      <button
                        type="button"
                        className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground border-t mt-3 transition-colors"
                        onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" /> Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" /> Show more
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="pb-4" />
                    )}
                  </Card>
                );
              })}
            </div>
          ) : hasSearched ? (
            <div className="text-center py-16">
              <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Search className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No results found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Try a different query or lower the relevance threshold.
              </p>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <BookOpen className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Search the knowledge base</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Enter a query above to find relevant documents.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
