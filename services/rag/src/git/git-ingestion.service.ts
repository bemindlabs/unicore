import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { readdirSync, lstatSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GitCloneService } from '../git-ingestion/git-clone.service';
import { CodeChunkerService, CodeChunk } from './chunker.service';
import { EmbeddingService } from '../ingestion/embedding.service';
import { QdrantService } from '../qdrant/qdrant.service';
import {
  IndexRepoDto,
  GitIndexStatus,
  GitRepoState,
  GitRepoStatusResponse,
} from '../git-ingestion/dto/git-ingestion.dto';

const BATCH_SIZE = 20;

@Injectable()
export class GitIngestionService {
  private readonly logger = new Logger(GitIngestionService.name);

  // In-memory state indexed by workspaceId
  private readonly stateMap = new Map<string, GitRepoState>();

  constructor(
    private readonly gitClone: GitCloneService,
    private readonly chunker: CodeChunkerService,
    private readonly embedding: EmbeddingService,
    private readonly qdrant: QdrantService,
  ) {}

  async indexRepo(dto: IndexRepoDto): Promise<{ repoId: string; status: GitIndexStatus }> {
    const repoId = this.buildRepoId(dto.workspaceId, dto.repoUrl);

    const state: GitRepoState = {
      repoId,
      repoUrl: dto.repoUrl,
      branch: dto.branch ?? 'main',
      workspaceId: dto.workspaceId,
      agentId: dto.agentId,
      status: GitIndexStatus.PENDING,
      indexedFiles: 0,
      totalChunks: 0,
      documentIds: [],
      startedAt: new Date().toISOString(),
    };

    this.stateMap.set(dto.workspaceId, state);

    // Fire-and-forget: respond immediately with PENDING status
    void this.runIngestion(state, dto.authToken).catch((err) => {
      this.logger.error(`Ingestion failed for ${repoId}: ${String(err)}`);
      state.status = GitIndexStatus.FAILED;
      state.error = String(err);
      state.completedAt = new Date().toISOString();
    });

    return { repoId, status: GitIndexStatus.PENDING };
  }

  private async runIngestion(state: GitRepoState, authToken?: string): Promise<void> {
    state.status = GitIndexStatus.INDEXING;
    const collectionName = QdrantService.collectionName(state.workspaceId);

    // 1. Clone or pull the repository
    const { localPath, headSha } = await this.gitClone.cloneOrPull(
      state.repoId,
      state.repoUrl,
      state.branch,
      authToken,
    );

    // 2. Skip if already indexed at this commit
    if (state.lastCommitSha && state.lastCommitSha === headSha) {
      this.logger.log(`Repo ${state.repoId} up-to-date at ${headSha}`);
      state.status = GitIndexStatus.DONE;
      state.completedAt = new Date().toISOString();
      return;
    }

    // 3. Get commit metadata (author, date) for chunk payloads
    const commitMeta = await this.gitClone.getCommitMeta(localPath);

    // 4. Remove old vectors for this repo (re-index)
    await this.qdrant.ensureCollection(collectionName);
    if (state.documentIds.length > 0) {
      await this.qdrant.deletePoints(collectionName, {
        must: [{ key: 'sourceId', match: { value: state.repoId } }],
      });
      state.documentIds = [];
    }

    // 5. Discover files
    const files = this.discoverFiles(localPath);
    this.logger.log(`Repo ${state.repoId}: ${files.length} files to process`);

    let indexedFiles = 0;
    let totalChunks = 0;
    const documentIds: string[] = [];

    // 6. Process in batches: chunk → embed → upsert
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
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

      const embeddings = await this.embedding.embedBatch(allChunks.map((c) => c.content));

      const points = allChunks.map((chunk, idx) => {
        const docId = uuidv4();
        documentIds.push(docId);
        return {
          id: docId,
          vector: embeddings[idx]!.embedding,
          payload: {
            documentId: docId,
            content: chunk.content,
            workspaceId: state.workspaceId,
            ...(state.agentId ? { agentId: state.agentId } : {}),
            source: 'git',
            sourceId: state.repoId,
            filePath: chunk.filePath,
            language: chunk.language,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            chunkType: chunk.chunkType,
            commitAuthor: chunk.commitAuthor,
            commitDate: chunk.commitDate,
            repoUrl: state.repoUrl,
            branch: state.branch,
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
    state.lastCommitSha = headSha;
    state.status = GitIndexStatus.DONE;
    state.completedAt = new Date().toISOString();

    this.logger.log(
      `Repo ${state.repoId} done: ${indexedFiles} files, ${totalChunks} chunks`,
    );
  }

  private static readonly MAX_TRAVERSAL_DEPTH = 20;

  private discoverFiles(dir: string, results: string[] = [], depth = 0): string[] {
    if (depth > GitIngestionService.MAX_TRAVERSAL_DEPTH) {
      this.logger.warn(`Max traversal depth (${GitIngestionService.MAX_TRAVERSAL_DEPTH}) reached at ${dir}, skipping`);
      return results;
    }

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
        stat = lstatSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) {
        this.logger.warn(`Skipping symlink: ${fullPath}`);
        continue;
      }
      if (stat.isDirectory()) {
        this.discoverFiles(fullPath, results, depth + 1);
      } else if (stat.isFile() && !this.chunker.isBinaryFile(fullPath)) {
        results.push(fullPath);
      }
    }

    return results;
  }

  getStatus(workspaceId: string): GitRepoStatusResponse {
    const state = this.stateMap.get(workspaceId);
    if (!state) {
      throw new NotFoundException(`No indexed repo for workspace ${workspaceId}`);
    }
    // Strip internal documentIds before returning
    const { documentIds: _ids, ...response } = state;
    return response as GitRepoStatusResponse;
  }

  async deleteIndex(workspaceId: string): Promise<{ deleted: boolean }> {
    const state = this.stateMap.get(workspaceId);
    if (!state) return { deleted: false };

    const collectionName = QdrantService.collectionName(workspaceId);
    const exists = await this.qdrant.collectionExists(collectionName);
    if (exists) {
      await this.qdrant.deletePoints(collectionName, {
        must: [{ key: 'sourceId', match: { value: state.repoId } }],
      });
    }

    await this.gitClone.cleanup(state.repoId);
    this.stateMap.delete(workspaceId);

    return { deleted: true };
  }

  private buildRepoId(workspaceId: string, repoUrl: string): string {
    const slug = Buffer.from(repoUrl).toString('base64url').slice(0, 16);
    return `${workspaceId}-${slug}`;
  }
}
