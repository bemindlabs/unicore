export interface DocumentMetadata {
  workspaceId: string;
  agentId?: string;
  source?: string;
  sourceId?: string;
  title?: string;
  author?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface Document {
  id: string;
  content: string;
  metadata: DocumentMetadata;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: DocumentMetadata & {
    chunkIndex: number;
    totalChunks: number;
    startChar: number;
    endChar: number;
  };
}

export interface EmbeddedChunk extends DocumentChunk {
  embedding: number[];
}

export interface ScopeFilter {
  workspaceId: string;
  agentId?: string;
}

export interface SearchResult {
  id: string;
  documentId: string;
  content: string;
  score: number;
  metadata: DocumentMetadata & {
    chunkIndex: number;
    totalChunks: number;
  };
}
