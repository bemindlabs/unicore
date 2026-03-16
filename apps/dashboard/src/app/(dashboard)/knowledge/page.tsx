'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Search,
  Upload,
  Trash2,
  FileText,
  Loader2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
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
  score: number;
  text: string;
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

  /* ---------- Fetch documents ---------- */

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await api.get<unknown>(
        '/api/proxy/rag/api/v1/ingest/info/default',
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
      await api.post('/api/proxy/rag/api/v1/ingest', {
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
      await api.delete(`/api/proxy/rag/api/v1/ingest/${docId}`);
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

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchText.trim()) return;

    setSearching(true);
    setHasSearched(true);
    try {
      const data = await api.post<unknown>('/api/proxy/rag/api/v1/query', {
        query: searchText.trim(),
        workspaceId: 'default',
        topK: 10,
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

      setSearchResults(results);

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
        <TabsContent value="search" className="space-y-6 mt-4">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  placeholder="Search Knowledge Base"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={searching || !searchText.trim()}>
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Search results */}
          {searching ? (
            <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">
              Searching...
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-3">
              {searchResults.map((result, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {result.documentTitle ?? 'Untitled'}
                          </span>
                          {result.score != null && (
                            <Badge variant="outline" className="text-xs">
                              {(result.score * 100).toFixed(1)}% match
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                          {result.text}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : hasSearched ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Search className="mx-auto h-8 w-8 mb-2 opacity-50" />
              No results found. Try a different query.
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <BookOpen className="mx-auto h-8 w-8 mb-2 opacity-50" />
              Enter a query above to search the knowledge base.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
