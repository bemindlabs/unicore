import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding.service';
import { DeleteScopeType } from '../common/dto/ingest.dto';

describe('IngestionService', () => {
  let service: IngestionService;

  const mockQdrant = {
    ensureCollection: jest.fn(),
    collectionExists: jest.fn(),
    upsertPoints: jest.fn(),
    deletePoints: jest.fn(),
    deleteCollection: jest.fn(),
    getCollectionInfo: jest.fn(),
  };

  const mockChunking = {
    split: jest.fn(),
  };

  const mockEmbedding = {
    embedBatch: jest.fn(),
  };

  const makeChunks = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      content: `Chunk content ${i}`,
      startChar: i * 100,
      endChar: i * 100 + 50,
      index: i,
    }));

  const makeEmbeddings = (n: number) =>
    Array.from({ length: n }, () => ({
      embedding: new Array(1536).fill(0.1),
      model: 'text-embedding-3-small',
      tokenCount: 10,
    }));

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: QdrantService, useValue: mockQdrant },
        { provide: ChunkingService, useValue: mockChunking },
        { provide: EmbeddingService, useValue: mockEmbedding },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);

    // Default happy-path mocks
    mockQdrant.ensureCollection.mockResolvedValue(undefined);
    mockQdrant.collectionExists.mockResolvedValue(true);
    mockQdrant.upsertPoints.mockResolvedValue(undefined);
    mockQdrant.deletePoints.mockResolvedValue(undefined);
    mockQdrant.deleteCollection.mockResolvedValue(undefined);
    mockQdrant.getCollectionInfo.mockResolvedValue({ points_count: 42 });
    mockChunking.split.mockReturnValue(makeChunks(3));
    mockEmbedding.embedBatch.mockResolvedValue(makeEmbeddings(3));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ingestDocument()', () => {
    const dto = {
      content: 'Some document content to ingest.',
      metadata: { workspaceId: 'ws-001', agentId: 'agent-a' },
    };

    it('should chunk, embed, delete old vectors, then upsert', async () => {
      const result = await service.ingestDocument(dto);

      expect(mockChunking.split).toHaveBeenCalledWith(dto.content);
      expect(mockEmbedding.embedBatch).toHaveBeenCalledWith(
        expect.arrayContaining(['Chunk content 0']),
      );
      expect(mockQdrant.deletePoints).toHaveBeenCalled();
      expect(mockQdrant.upsertPoints).toHaveBeenCalledWith(
        'ws_ws_001',
        expect.any(Array),
      );
      expect(result.chunksIngested).toBe(3);
    });

    it('should generate a documentId when not provided', async () => {
      const result = await service.ingestDocument(dto);
      expect(result.documentId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should use provided documentId when given', async () => {
      const result = await service.ingestDocument({ ...dto, id: 'my-doc-id' });
      expect(result.documentId).toBe('my-doc-id');
    });

    it('should throw BadRequestException when no chunks produced', async () => {
      mockChunking.split.mockReturnValueOnce([]);
      await expect(service.ingestDocument(dto)).rejects.toThrow(BadRequestException);
    });

    it('should return correct collectionName', async () => {
      const result = await service.ingestDocument(dto);
      expect(result.collectionName).toBe('ws_ws_001');
    });
  });

  describe('ingestBatch()', () => {
    it('should process all documents and return aggregate results', async () => {
      const docs = [
        { content: 'Doc 1', metadata: { workspaceId: 'ws-001' } },
        { content: 'Doc 2', metadata: { workspaceId: 'ws-001' } },
      ];

      const result = await service.ingestBatch(docs);
      expect(result.results).toHaveLength(2);
      expect(result.totalChunks).toBe(6); // 3 chunks per doc
      expect(result.failedDocuments).toHaveLength(0);
    });

    it('should record failures without aborting the batch', async () => {
      mockChunking.split
        .mockReturnValueOnce(makeChunks(3))
        .mockReturnValueOnce([]); // second doc will fail

      const docs = [
        { content: 'Good doc', metadata: { workspaceId: 'ws-001' } },
        { content: 'Bad doc', metadata: { workspaceId: 'ws-001' } },
      ];

      const result = await service.ingestBatch(docs);
      expect(result.results).toHaveLength(1);
      expect(result.failedDocuments).toHaveLength(1);
      expect(result.failedDocuments[0]!.index).toBe(1);
    });
  });

  describe('deleteDocuments()', () => {
    it('should delete by documentId for scope=document', async () => {
      await service.deleteDocuments({
        scope: DeleteScopeType.DOCUMENT,
        workspaceId: 'ws-001',
        documentId: 'doc-abc',
      });
      expect(mockQdrant.deletePoints).toHaveBeenCalledWith(
        'ws_ws_001',
        expect.objectContaining({
          must: expect.arrayContaining([
            expect.objectContaining({ key: 'documentId' }),
          ]),
        }),
      );
    });

    it('should delete by agentId for scope=agent', async () => {
      await service.deleteDocuments({
        scope: DeleteScopeType.AGENT,
        workspaceId: 'ws-001',
        agentId: 'agent-x',
      });
      expect(mockQdrant.deletePoints).toHaveBeenCalledWith(
        'ws_ws_001',
        expect.objectContaining({
          must: expect.arrayContaining([
            expect.objectContaining({ key: 'agentId' }),
          ]),
        }),
      );
    });

    it('should delete collection for scope=workspace', async () => {
      await service.deleteDocuments({
        scope: DeleteScopeType.WORKSPACE,
        workspaceId: 'ws-001',
      });
      expect(mockQdrant.deleteCollection).toHaveBeenCalledWith('ws_ws_001');
    });

    it('should return deleted=false when collection does not exist', async () => {
      mockQdrant.collectionExists.mockResolvedValueOnce(false);
      const result = await service.deleteDocuments({
        scope: DeleteScopeType.DOCUMENT,
        workspaceId: 'ws-999',
        documentId: 'doc-xyz',
      });
      expect(result.deleted).toBe(false);
    });
  });
});
