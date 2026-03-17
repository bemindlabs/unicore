// Knowledge Base Types

export enum DocumentType {
  TEXT = 'TEXT',
  URL = 'URL',
  PDF = 'PDF',
  CSV = 'CSV',
  MARKDOWN = 'MARKDOWN',
}

export interface DocumentMetadata {
  source: string;
  fileType: string;
  size: number;
  pages?: number;
  chunks: number;
}

export interface IngestedDocument {
  id: string;
  title: string;
  type: DocumentType;
  content: string;
  metadata: DocumentMetadata;
  createdAt: string;
  workspaceId: string;
}

export interface SearchResult {
  documentId: string;
  snippet: string;
  score: number;
  metadata: DocumentMetadata;
}

export interface KnowledgeBaseQuery {
  query: string;
  workspaceId: string;
  topK: number;
  threshold?: number;
}

export interface ChunkInfo {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  position: number;
}
