import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => {
      const config: Record<string, unknown> = {
        AI_ENGINE_URL: 'http://localhost:4001',
        AI_ENGINE_API_KEY: undefined,
        EMBEDDING_MODEL: 'text-embedding-3-small',
        EMBEDDING_DIMENSIONS: 1536,
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
    mockFetch.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('embed()', () => {
    it('should return embedding from AI engine when available', async () => {
      const fakeEmbedding = new Array(1536).fill(0.1);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embedding: fakeEmbedding,
          model: 'text-embedding-3-small',
          tokenCount: 10,
        }),
      });

      const result = await service.embed({ text: 'Hello world' });
      expect(result.embedding).toHaveLength(1536);
      expect(result.model).toBe('text-embedding-3-small');
    });

    it('should fall back to stub embedding when AI engine is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.embed({ text: 'Hello world' });
      expect(result.embedding).toHaveLength(1536);
      // Stub embeddings are unit vectors (magnitude ≈ 1)
      const magnitude = Math.sqrt(
        result.embedding.reduce((sum, v) => sum + v * v, 0),
      );
      expect(magnitude).toBeCloseTo(1, 3);
    });

    it('should return deterministic stub embeddings for the same text', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const r1 = await service.embed({ text: 'consistent text' });
      const r2 = await service.embed({ text: 'consistent text' });
      expect(r1.embedding).toEqual(r2.embedding);
    });

    it('should return different embeddings for different texts', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const r1 = await service.embed({ text: 'text one' });
      const r2 = await service.embed({ text: 'text two' });
      expect(r1.embedding).not.toEqual(r2.embedding);
    });
  });

  describe('embedBatch()', () => {
    it('should return an embedding for each input text', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      // After batch fails it falls back to individual stub calls

      const results = await service.embedBatch(['text a', 'text b', 'text c']);
      expect(results).toHaveLength(3);
      results.forEach((r) => {
        expect(r.embedding).toHaveLength(1536);
      });
    });

    it('should call batch endpoint when AI engine is available', async () => {
      const batchResponse = ['a', 'b'].map(() => ({
        embedding: new Array(1536).fill(0.2),
        model: 'text-embedding-3-small',
        tokenCount: 5,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => batchResponse,
      });

      const results = await service.embedBatch(['text a', 'text b']);
      expect(results).toHaveLength(2);
    });
  });
});
