import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type Schemas } from '@qdrant/js-client-rest';
import { QdrantService } from '../qdrant/qdrant.service';
import { EmbeddingService } from '../ingestion/embedding.service';
import type { RetrievalQueryDto, RetrievalResponseDto, SearchResultDto } from '../common/dto/retrieval.dto';

type Filter = Schemas['Filter'];

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly qdrant: QdrantService,
    private readonly embedding: EmbeddingService,
  ) {}

  /**
   * Perform semantic search over a workspace collection.
   *
   * Memory scoping works at two levels:
   *  1. Collection per workspace — each workspaceId maps to a dedicated Qdrant collection.
   *  2. Payload filter per agentId — when an agentId is provided, results are restricted
   *     to vectors tagged with that agent, allowing agent-private memory within a shared
   *     workspace collection.
   */
  async query(dto: RetrievalQueryDto): Promise<RetrievalResponseDto> {
    const collectionName = QdrantService.collectionName(dto.workspaceId);

    const exists = await this.qdrant.collectionExists(collectionName);
    if (!exists) {
      this.logger.warn(
        `Collection ${collectionName} does not exist for workspace ${dto.workspaceId}`,
      );
      return {
        results: [],
        query: dto.query,
        workspaceId: dto.workspaceId,
        totalFound: 0,
      };
    }

    // Embed the query
    const { embedding } = await this.embedding.embed({ text: dto.query });

    // Build Qdrant filter for memory scoping
    const filter = this.buildScopeFilter(dto.workspaceId, dto.agentId);

    // Execute vector search
    const searchResults = await this.qdrant.search({
      collectionName,
      vector: embedding,
      limit: dto.limit ?? 5,
      scoreThreshold: dto.scoreThreshold,
      filter,
      withPayload: true,
    });

    this.logger.debug(
      `Query on ${collectionName}: ${searchResults.length} results (limit=${dto.limit}, threshold=${dto.scoreThreshold})`,
    );

    const results: SearchResultDto[] = searchResults.map((r) => {
      const payload = (r.payload ?? {}) as Record<string, unknown>;
      return {
        id: String(r.id),
        documentId: String(payload['documentId'] ?? ''),
        score: r.score,
        content: dto.includeContent !== false ? String(payload['content'] ?? '') : undefined,
        metadata: {
          workspaceId: payload['workspaceId'],
          agentId: payload['agentId'],
          chunkIndex: payload['chunkIndex'],
          totalChunks: payload['totalChunks'],
          source: payload['source'],
          sourceId: payload['sourceId'],
          title: payload['title'],
          author: payload['author'],
          createdAt: payload['createdAt'],
        },
      };
    });

    return {
      results,
      query: dto.query,
      workspaceId: dto.workspaceId,
      totalFound: results.length,
    };
  }

  /**
   * Retrieve all chunks for a specific document within a workspace.
   */
  async getDocumentChunks(
    workspaceId: string,
    documentId: string,
  ): Promise<{ chunks: Array<{ id: string; chunkIndex: number; content: string }> }> {
    const collectionName = QdrantService.collectionName(workspaceId);
    const exists = await this.qdrant.collectionExists(collectionName);

    if (!exists) {
      throw new NotFoundException(`Workspace ${workspaceId} has no vector collection`);
    }

    // Scroll through all points matching the documentId
    // We use a zero-vector search with a strict filter as a workaround,
    // since the JS client scroll API may vary across versions.
    const dummyVector = new Array<number>(1536).fill(0);
    const results = await this.qdrant.search({
      collectionName,
      vector: dummyVector,
      limit: 1000,
      filter: {
        must: [{ key: 'documentId', match: { value: documentId } }],
      },
      withPayload: true,
    });

    const chunks = results
      .map((r) => {
        const payload = (r.payload ?? {}) as Record<string, unknown>;
        return {
          id: String(r.id),
          chunkIndex: Number(payload['chunkIndex'] ?? 0),
          content: String(payload['content'] ?? ''),
        };
      })
      .sort((a, b) => a.chunkIndex - b.chunkIndex);

    return { chunks };
  }

  /**
   * Build a Qdrant filter that scopes results to the workspace (and optionally agent).
   */
  private buildScopeFilter(workspaceId: string, agentId?: string): Filter {
    const mustConditions: Filter['must'] = [
      {
        key: 'workspaceId',
        match: { value: workspaceId },
      },
    ];

    if (agentId) {
      mustConditions.push({
        key: 'agentId',
        match: { value: agentId },
      });
    }

    return { must: mustConditions };
  }
}
