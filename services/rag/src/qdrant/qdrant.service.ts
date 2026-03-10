import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient, type Schemas } from '@qdrant/js-client-rest';

type PointStruct = Schemas['PointStruct'];
type Filter = Schemas['Filter'];
type ScoredPoint = Schemas['ScoredPoint'];
type CollectionInfo = Schemas['CollectionInfo'];

export interface UpsertPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface SearchOptions {
  collectionName: string;
  vector: number[];
  limit?: number;
  scoreThreshold?: number;
  filter?: Filter;
  withPayload?: boolean;
}

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client!: QdrantClient;
  private readonly vectorSize: number;

  constructor(private readonly config: ConfigService) {
    this.vectorSize = this.config.get<number>('EMBEDDING_DIMENSIONS', 1536);
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.getOrThrow<string>('QDRANT_URL');
    const apiKey = this.config.get<string>('QDRANT_API_KEY');

    this.client = new QdrantClient({
      url,
      ...(apiKey ? { apiKey } : {}),
    });

    this.logger.log(`Qdrant client connected to ${url}`);
  }

  async ensureCollection(collectionName: string): Promise<void> {
    const exists = await this.collectionExists(collectionName);
    if (!exists) {
      await this.createCollection(collectionName);
    }
  }

  async collectionExists(collectionName: string): Promise<boolean> {
    try {
      const result = await this.client.getCollections();
      return result.collections.some((c) => c.name === collectionName);
    } catch (err) {
      this.logger.warn(`Failed to check collection existence: ${String(err)}`);
      return false;
    }
  }

  async createCollection(collectionName: string): Promise<void> {
    await this.client.createCollection(collectionName, {
      vectors: {
        size: this.vectorSize,
        distance: 'Cosine',
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
    });

    // Create payload indexes for efficient filtering
    await this.client.createPayloadIndex(collectionName, {
      field_name: 'workspaceId',
      field_schema: 'keyword',
    });

    await this.client.createPayloadIndex(collectionName, {
      field_name: 'agentId',
      field_schema: 'keyword',
    });

    await this.client.createPayloadIndex(collectionName, {
      field_name: 'documentId',
      field_schema: 'keyword',
    });

    this.logger.log(`Collection created: ${collectionName}`);
  }

  async deleteCollection(collectionName: string): Promise<void> {
    await this.client.deleteCollection(collectionName);
    this.logger.log(`Collection deleted: ${collectionName}`);
  }

  async getCollectionInfo(collectionName: string): Promise<CollectionInfo> {
    return this.client.getCollection(collectionName);
  }

  async upsertPoints(collectionName: string, points: UpsertPoint[]): Promise<void> {
    const qdrantPoints: PointStruct[] = points.map((p) => ({
      id: this.encodeId(p.id),
      vector: p.vector,
      payload: p.payload,
    }));

    await this.client.upsert(collectionName, {
      points: qdrantPoints,
      wait: true,
    });

    this.logger.debug(`Upserted ${points.length} points to ${collectionName}`);
  }

  async deletePoints(collectionName: string, filter: Filter): Promise<void> {
    await this.client.delete(collectionName, {
      filter,
      wait: true,
    });
    this.logger.debug(`Deleted points from ${collectionName} with filter`);
  }

  async deletePointById(collectionName: string, id: string): Promise<void> {
    await this.client.delete(collectionName, {
      points: [this.encodeId(id)],
      wait: true,
    });
  }

  async search(options: SearchOptions): Promise<ScoredPoint[]> {
    return this.client.search(options.collectionName, {
      vector: options.vector,
      limit: options.limit ?? 5,
      score_threshold: options.scoreThreshold,
      with_payload: options.withPayload ?? true,
      ...(options.filter ? { filter: options.filter } : {}),
    });
  }

  async listCollections(): Promise<string[]> {
    const result = await this.client.getCollections();
    return result.collections.map((c) => c.name);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Encode a UUID string to a uint64-compatible numeric id for Qdrant.
   * We use a deterministic hash of the UUID so IDs remain consistent.
   * Qdrant accepts string UUIDs directly in newer versions of the REST client.
   */
  private encodeId(id: string): string {
    return id;
  }

  /**
   * Derive a collection name from a workspaceId.
   * Each workspace gets its own isolated collection for memory scoping.
   */
  static collectionName(workspaceId: string): string {
    // Sanitize to alphanumeric + underscore
    return `ws_${workspaceId.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
}
