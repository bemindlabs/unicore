import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { QdrantService } from '../qdrant/qdrant.service';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding.service';
import type { DocumentChunk, EmbeddedChunk } from '../common/interfaces/document.interface';
import type { IngestDocumentDto, DeleteDocumentsDto } from '../common/dto/ingest.dto';
import { DeleteScopeType } from '../common/dto/ingest.dto';

export interface IngestionResult {
  documentId: string;
  chunksIngested: number;
  collectionName: string;
}

export interface BatchIngestionResult {
  results: IngestionResult[];
  totalChunks: number;
  failedDocuments: Array<{ index: number; error: string }>;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly qdrant: QdrantService,
    private readonly chunking: ChunkingService,
    private readonly embedding: EmbeddingService,
  ) {}

  async ingestDocument(dto: IngestDocumentDto): Promise<IngestionResult> {
    const documentId = dto.id ?? uuidv4();
    const { workspaceId } = dto.metadata;

    const collectionName = QdrantService.collectionName(workspaceId);
    await this.qdrant.ensureCollection(collectionName);

    // Step 1: Chunk the document
    const textChunks = this.chunking.split(dto.content);

    if (textChunks.length === 0) {
      throw new BadRequestException('Document content produced no chunks');
    }

    this.logger.debug(
      `Document ${documentId}: ${textChunks.length} chunks from ${dto.content.length} chars`,
    );

    // Step 2: Build DocumentChunk objects
    const chunks: DocumentChunk[] = textChunks.map((tc, i) => ({
      id: uuidv4(),
      documentId,
      content: tc.content,
      chunkIndex: i,
      metadata: {
        ...dto.metadata,
        chunkIndex: i,
        totalChunks: textChunks.length,
        startChar: tc.startChar,
        endChar: tc.endChar,
      },
    }));

    // Step 3: Embed all chunks (batch for efficiency)
    const texts = chunks.map((c) => c.content);
    const embeddings = await this.embedding.embedBatch(texts);

    const embeddedChunks: EmbeddedChunk[] = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i]!.embedding,
    }));

    // Step 4: Delete any existing vectors for this documentId (re-ingest)
    await this.deleteByDocumentId(collectionName, documentId);

    // Step 5: Upsert into Qdrant
    await this.qdrant.upsertPoints(
      collectionName,
      embeddedChunks.map((ec) => ({
        id: ec.id,
        vector: ec.embedding,
        payload: {
          documentId: ec.documentId,
          content: ec.content,
          chunkIndex: ec.chunkIndex,
          totalChunks: textChunks.length,
          startChar: ec.metadata.startChar,
          endChar: ec.metadata.endChar,
          workspaceId: ec.metadata.workspaceId,
          ...(ec.metadata.agentId ? { agentId: ec.metadata.agentId } : {}),
          ...(ec.metadata.source ? { source: ec.metadata.source } : {}),
          ...(ec.metadata.sourceId ? { sourceId: ec.metadata.sourceId } : {}),
          ...(ec.metadata.title ? { title: ec.metadata.title } : {}),
          ...(ec.metadata.author ? { author: ec.metadata.author } : {}),
          ...(ec.metadata.createdAt ? { createdAt: ec.metadata.createdAt } : {}),
        },
      })),
    );

    this.logger.log(
      `Ingested document ${documentId} → ${chunks.length} chunks in ${collectionName}`,
    );

    return { documentId, chunksIngested: chunks.length, collectionName };
  }

  async ingestBatch(documents: IngestDocumentDto[]): Promise<BatchIngestionResult> {
    const results: IngestionResult[] = [];
    const failedDocuments: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]!;
      try {
        const result = await this.ingestDocument(doc);
        results.push(result);
      } catch (err) {
        failedDocuments.push({ index: i, error: String(err) });
        this.logger.error(`Failed to ingest document at index ${i}: ${String(err)}`);
      }
    }

    return {
      results,
      totalChunks: results.reduce((sum, r) => sum + r.chunksIngested, 0),
      failedDocuments,
    };
  }

  async deleteDocuments(dto: DeleteDocumentsDto): Promise<{ deleted: boolean }> {
    const collectionName = QdrantService.collectionName(dto.workspaceId);
    const exists = await this.qdrant.collectionExists(collectionName);

    if (!exists) {
      return { deleted: false };
    }

    switch (dto.scope) {
      case DeleteScopeType.DOCUMENT: {
        if (!dto.documentId) {
          throw new BadRequestException('documentId required for scope=document');
        }
        await this.deleteByDocumentId(collectionName, dto.documentId);
        break;
      }

      case DeleteScopeType.AGENT: {
        if (!dto.agentId) {
          throw new BadRequestException('agentId required for scope=agent');
        }
        await this.qdrant.deletePoints(collectionName, {
          must: [
            {
              key: 'agentId',
              match: { value: dto.agentId },
            },
          ],
        });
        break;
      }

      case DeleteScopeType.WORKSPACE: {
        // Delete the entire collection for this workspace
        await this.qdrant.deleteCollection(collectionName);
        break;
      }
    }

    return { deleted: true };
  }

  private async deleteByDocumentId(
    collectionName: string,
    documentId: string,
  ): Promise<void> {
    const exists = await this.qdrant.collectionExists(collectionName);
    if (!exists) return;

    await this.qdrant.deletePoints(collectionName, {
      must: [
        {
          key: 'documentId',
          match: { value: documentId },
        },
      ],
    });
  }

  async getDocumentInfo(workspaceId: string): Promise<{ collectionName: string; pointCount: number } | null> {
    const collectionName = QdrantService.collectionName(workspaceId);
    const exists = await this.qdrant.collectionExists(collectionName);
    if (!exists) return null;

    const info = await this.qdrant.getCollectionInfo(collectionName);
    return {
      collectionName,
      pointCount: info.points_count ?? 0,
    };
  }
}
