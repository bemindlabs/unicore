/**
 * GitRepoIngestor — Clones a Git repository, walks files with glob filters
 * and max file size constraints, chunks code by function/class boundaries
 * (or fixed-size with overlap), creates embeddings, and stores them in Qdrant.
 *
 * Endpoint: POST /api/v1/ingest/git-repo { url, branch, filters }
 */

import { Injectable, Logger } from '@nestjs/common';
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GitCloneService } from '../git-ingestion/git-clone.service';
import { CodeChunkerService, CodeChunk } from '../git/chunker.service';
import { EmbeddingService } from '../ingestion/embedding.service';
import { QdrantService } from '../qdrant/qdrant.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitRepoIngestOptions {
  /** Git repository URL (HTTPS or SSH) */
  url: string;
  /** Branch to clone (default: 'main') */
  branch?: string;
  /** Authentication token for private repos */
  authToken?: string;
  /** Workspace ID for Qdrant collection scoping */
  workspaceId: string;
  /** Optional agent ID for agent-scoped memory */
  agentId?: string;
  /** Glob patterns to include (e.g. ['src/**\/*.ts', '**\/*.py']). Empty = all files. */
  filters?: string[];
  /** Maximum file size in bytes (default: 1MB). Files larger are skipped. */
  maxFileSize?: number;
}

export interface GitRepoIngestResult {
  repoId: string;
  status: 'pending' | 'indexing' | 'done' | 'failed';
  indexedFiles: number;
  totalChunks: number;
  skippedFiles: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// Internal state for tracking in-flight ingestion jobs
interface IngestJobState extends GitRepoIngestResult {
  workspaceId: string;
  documentIds: string[];
}

// ---------------------------------------------------------------------------
// Glob matching (minimal, no external dependency)
// ---------------------------------------------------------------------------

function globToRegex(pattern: string): RegExp {
  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i]!;
    if (c === '*' && pattern[i + 1] === '*') {
      // '**' matches any path segments
      regex += '.*';
      i += 2;
      if (pattern[i] === '/') i++; // skip trailing slash
    } else if (c === '*') {
      // '*' matches anything except '/'
      regex += '[^/]*';
      i++;
    } else if (c === '?') {
      regex += '[^/]';
      i++;
    } else if (c === '.') {
      regex += '\\.';
      i++;
    } else {
      regex += c;
      i++;
    }
  }
  return new RegExp(`^${regex}$`);
}

function matchesAnyGlob(filePath: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;
  return patterns.some((p) => globToRegex(p).test(filePath));
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_FILE_SIZE = 1024 * 1024; // 1 MB
const BATCH_SIZE = 20;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class GitRepoIngestor {
  private readonly logger = new Logger(GitRepoIngestor.name);
  private readonly jobs = new Map<string, IngestJobState>();

  constructor(
    private readonly gitClone: GitCloneService,
    private readonly chunker: CodeChunkerService,
    private readonly embedding: EmbeddingService,
    private readonly qdrant: QdrantService,
  ) {}

  /**
   * Starts an async ingestion job. Returns immediately with PENDING status.
   */
  async ingest(options: GitRepoIngestOptions): Promise<GitRepoIngestResult> {
    const repoId = this.buildRepoId(options.workspaceId, options.url);
    const branch = options.branch ?? 'main';

    const state: IngestJobState = {
      repoId,
      workspaceId: options.workspaceId,
      status: 'pending',
      indexedFiles: 0,
      totalChunks: 0,
      skippedFiles: 0,
      documentIds: [],
      startedAt: new Date().toISOString(),
    };

    this.jobs.set(repoId, state);

    // Fire-and-forget
    void this.runIngestion(state, {
      ...options,
      branch,
    }).catch((err) => {
      this.logger.error(`Git repo ingestion failed for ${repoId}: ${String(err)}`);
      state.status = 'failed';
      state.error = String(err);
      state.completedAt = new Date().toISOString();
    });

    return this.toResult(state);
  }

  /**
   * Returns the current status of an ingestion job.
   */
  getStatus(repoId: string): GitRepoIngestResult | null {
    const state = this.jobs.get(repoId);
    return state ? this.toResult(state) : null;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async runIngestion(
    state: IngestJobState,
    options: GitRepoIngestOptions & { branch: string },
  ): Promise<void> {
    state.status = 'indexing';
    const collectionName = QdrantService.collectionName(options.workspaceId);
    const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    const filters = options.filters ?? [];

    // 1. Clone or pull
    const { localPath, headSha } = await this.gitClone.cloneOrPull(
      state.repoId,
      options.url,
      options.branch,
      options.authToken,
    );

    // 2. Get commit metadata
    const commitMeta = await this.gitClone.getCommitMeta(localPath);

    // 3. Ensure Qdrant collection
    await this.qdrant.ensureCollection(collectionName);

    // 4. Remove old vectors for this repo
    if (state.documentIds.length > 0) {
      await this.qdrant.deletePoints(collectionName, {
        must: [{ key: 'sourceId', match: { value: state.repoId } }],
      });
      state.documentIds = [];
    }

    // 5. Discover and filter files
    const allFiles = this.discoverFiles(localPath);
    const filtered: string[] = [];
    let skipped = 0;

    for (const absPath of allFiles) {
      const relPath = relative(localPath, absPath);

      // Apply glob filters
      if (!matchesAnyGlob(relPath, filters)) {
        skipped++;
        continue;
      }

      // Apply max file size
      try {
        const stat = statSync(absPath);
        if (stat.size > maxFileSize) {
          skipped++;
          continue;
        }
      } catch {
        skipped++;
        continue;
      }

      filtered.push(absPath);
    }

    this.logger.log(
      `Repo ${state.repoId}: ${filtered.length} files to index, ${skipped} skipped`,
    );

    let indexedFiles = 0;
    let totalChunks = 0;
    const documentIds: string[] = [];

    // 6. Process in batches: chunk -> embed -> upsert
    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
      const batch = filtered.slice(i, i + BATCH_SIZE);
      const allChunks: CodeChunk[] = [];

      for (const filePath of batch) {
        const chunks = await this.chunker.chunkFile({
          filePath,
          repoRoot: localPath,
          commitAuthor: commitMeta.author,
          commitDate: commitMeta.date,
        });
        if (chunks.length > 0) {
          allChunks.push(...chunks);
          indexedFiles++;
        }
      }

      if (allChunks.length === 0) continue;

      const embeddings = await this.embedding.embedBatch(
        allChunks.map((c) => c.content),
      );

      const points = allChunks.map((chunk, idx) => {
        const docId = uuidv4();
        documentIds.push(docId);
        return {
          id: docId,
          vector: embeddings[idx]!.embedding,
          payload: {
            documentId: docId,
            content: chunk.content,
            workspaceId: options.workspaceId,
            ...(options.agentId ? { agentId: options.agentId } : {}),
            source: 'git',
            sourceId: state.repoId,
            filePath: chunk.filePath,
            language: chunk.language,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            chunkType: chunk.chunkType,
            commitAuthor: chunk.commitAuthor,
            commitDate: chunk.commitDate,
            repoUrl: options.url,
            branch: options.branch,
            commitSha: headSha,
          },
        };
      });

      await this.qdrant.upsertPoints(collectionName, points);
      totalChunks += allChunks.length;
    }

    state.documentIds = documentIds;
    state.indexedFiles = indexedFiles;
    state.totalChunks = totalChunks;
    state.skippedFiles = skipped;
    state.status = 'done';
    state.completedAt = new Date().toISOString();

    this.logger.log(
      `Repo ${state.repoId} done: ${indexedFiles} files, ${totalChunks} chunks, ${skipped} skipped`,
    );
  }

  private discoverFiles(dir: string, results: string[] = []): string[] {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (this.chunker.shouldSkipPath(entry)) continue;
      const fullPath = join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        this.discoverFiles(fullPath, results);
      } else if (stat.isFile() && !this.chunker.isBinaryFile(fullPath)) {
        results.push(fullPath);
      }
    }

    return results;
  }

  private buildRepoId(workspaceId: string, repoUrl: string): string {
    const slug = Buffer.from(repoUrl).toString('base64url').slice(0, 16);
    return `${workspaceId}-${slug}`;
  }

  private toResult(state: IngestJobState): GitRepoIngestResult {
    return {
      repoId: state.repoId,
      status: state.status,
      indexedFiles: state.indexedFiles,
      totalChunks: state.totalChunks,
      skippedFiles: state.skippedFiles,
      error: state.error,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
    };
  }
}
