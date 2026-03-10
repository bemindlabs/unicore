import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RetrievalService } from './retrieval.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { EmbeddingService } from '../ingestion/embedding.service';

describe('RetrievalService', () => {
  let service: RetrievalService;

  const mockQdrant = {
    collectionExists: jest.fn(),
    search: jest.fn(),
  };

  const mockEmbedding = {
    embed: jest.fn(),
  };

  const fakeEmbedding = new Array(1536).fill(0.1);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetrievalService,
        { provide: QdrantService, useValue: mockQdrant },
        { provide: EmbeddingService, useValue: mockEmbedding },
      ],
    }).compile();

    service = module.get<RetrievalService>(RetrievalService);

    mockEmbedding.embed.mockResolvedValue({
      embedding: fakeEmbedding,
      model: 'text-embedding-3-small',
      tokenCount: 5,
    });
    mockQdrant.collectionExists.mockResolvedValue(true);
    mockQdrant.search.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('query()', () => {
    const queryDto = {
      query: 'What is the refund policy?',
      workspaceId: 'ws-001',
      limit: 5,
      scoreThreshold: 0.7,
      includeContent: true,
    };

    it('should embed the query and call qdrant search', async () => {
      mockQdrant.search.mockResolvedValueOnce([
        {
          id: 'chunk-1',
          score: 0.92,
          payload: {
            documentId: 'doc-1',
            content: 'Refund within 30 days.',
            workspaceId: 'ws-001',
            chunkIndex: 0,
            totalChunks: 1,
          },
        },
      ]);

      const result = await service.query(queryDto);

      expect(mockEmbedding.embed).toHaveBeenCalledWith({ text: queryDto.query });
      expect(mockQdrant.search).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: 'ws_ws_001',
          vector: fakeEmbedding,
          limit: 5,
          scoreThreshold: 0.7,
        }),
      );
      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.score).toBe(0.92);
      expect(result.results[0]!.content).toBe('Refund within 30 days.');
    });

    it('should return empty results when collection does not exist', async () => {
      mockQdrant.collectionExists.mockResolvedValueOnce(false);
      const result = await service.query(queryDto);
      expect(result.results).toHaveLength(0);
      expect(result.totalFound).toBe(0);
      expect(mockQdrant.search).not.toHaveBeenCalled();
    });

    it('should scope filter by workspaceId', async () => {
      await service.query(queryDto);
      const call = mockQdrant.search.mock.calls[0]![0] as { filter: { must: Array<{ key: string }> } };
      expect(call.filter.must).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'workspaceId' }),
        ]),
      );
    });

    it('should add agentId filter when agentId is provided', async () => {
      await service.query({ ...queryDto, agentId: 'agent-x' });
      const call = mockQdrant.search.mock.calls[0]![0] as { filter: { must: Array<{ key: string }> } };
      const keys = call.filter.must.map((c) => c.key);
      expect(keys).toContain('workspaceId');
      expect(keys).toContain('agentId');
    });

    it('should not add agentId filter when agentId is absent', async () => {
      await service.query(queryDto);
      const call = mockQdrant.search.mock.calls[0]![0] as { filter: { must: Array<{ key: string }> } };
      const keys = call.filter.must.map((c) => c.key);
      expect(keys).not.toContain('agentId');
    });

    it('should omit content when includeContent=false', async () => {
      mockQdrant.search.mockResolvedValueOnce([
        {
          id: 'chunk-1',
          score: 0.9,
          payload: {
            documentId: 'doc-1',
            content: 'Some content',
            workspaceId: 'ws-001',
            chunkIndex: 0,
            totalChunks: 1,
          },
        },
      ]);

      const result = await service.query({ ...queryDto, includeContent: false });
      expect(result.results[0]!.content).toBeUndefined();
    });
  });

  describe('getDocumentChunks()', () => {
    it('should throw NotFoundException when workspace collection missing', async () => {
      mockQdrant.collectionExists.mockResolvedValueOnce(false);
      await expect(
        service.getDocumentChunks('ws-missing', 'doc-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return chunks sorted by chunkIndex', async () => {
      mockQdrant.search.mockResolvedValueOnce([
        { id: 'c2', score: 0.1, payload: { chunkIndex: 1, content: 'second', documentId: 'doc-1' } },
        { id: 'c1', score: 0.1, payload: { chunkIndex: 0, content: 'first', documentId: 'doc-1' } },
      ]);

      const result = await service.getDocumentChunks('ws-001', 'doc-1');
      expect(result.chunks[0]!.chunkIndex).toBe(0);
      expect(result.chunks[1]!.chunkIndex).toBe(1);
    });
  });
});
