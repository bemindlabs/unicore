import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QdrantService } from './qdrant.service';

// Mock Qdrant JS client
const mockQdrantClient = {
  getCollections: jest.fn(),
  createCollection: jest.fn(),
  deleteCollection: jest.fn(),
  getCollection: jest.fn(),
  createPayloadIndex: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  search: jest.fn(),
};

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => mockQdrantClient),
}));

describe('QdrantService', () => {
  let service: QdrantService;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'QDRANT_URL') return 'http://localhost:6333';
      throw new Error(`Missing config: ${key}`);
    }),
    get: jest.fn((key: string, defaultValue: unknown) => {
      if (key === 'QDRANT_API_KEY') return undefined;
      if (key === 'EMBEDDING_DIMENSIONS') return 1536;
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QdrantService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<QdrantService>(QdrantService);

    // Initialize the client (normally done in onModuleInit)
    await service.onModuleInit();

    // Reset mocks after init
    Object.values(mockQdrantClient).forEach((m) => (m as jest.Mock).mockReset());
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('collectionName()', () => {
    it('should prefix with ws_', () => {
      expect(QdrantService.collectionName('workspace-123')).toBe('ws_workspace_123');
    });

    it('should replace non-alphanumeric chars with underscore', () => {
      expect(QdrantService.collectionName('my-ws.id')).toBe('ws_my_ws_id');
    });
  });

  describe('collectionExists()', () => {
    it('should return true when collection is in the list', async () => {
      mockQdrantClient.getCollections.mockResolvedValueOnce({
        collections: [{ name: 'ws_test' }],
      });
      expect(await service.collectionExists('ws_test')).toBe(true);
    });

    it('should return false when collection is not in the list', async () => {
      mockQdrantClient.getCollections.mockResolvedValueOnce({
        collections: [],
      });
      expect(await service.collectionExists('ws_missing')).toBe(false);
    });

    it('should return false on error', async () => {
      mockQdrantClient.getCollections.mockRejectedValueOnce(new Error('Network error'));
      expect(await service.collectionExists('ws_test')).toBe(false);
    });
  });

  describe('ensureCollection()', () => {
    it('should create collection if it does not exist', async () => {
      mockQdrantClient.getCollections.mockResolvedValueOnce({ collections: [] });
      mockQdrantClient.createCollection.mockResolvedValueOnce(true);
      mockQdrantClient.createPayloadIndex.mockResolvedValue(undefined);

      await service.ensureCollection('ws_new');
      expect(mockQdrantClient.createCollection).toHaveBeenCalledWith('ws_new', expect.any(Object));
    });

    it('should skip creation if collection already exists', async () => {
      mockQdrantClient.getCollections.mockResolvedValueOnce({
        collections: [{ name: 'ws_existing' }],
      });

      await service.ensureCollection('ws_existing');
      expect(mockQdrantClient.createCollection).not.toHaveBeenCalled();
    });
  });

  describe('upsertPoints()', () => {
    it('should call qdrant upsert with correctly shaped points', async () => {
      mockQdrantClient.upsert.mockResolvedValueOnce({ status: 'completed' });

      await service.upsertPoints('ws_test', [
        { id: 'abc-123', vector: [0.1, 0.2], payload: { workspaceId: 'ws1' } },
      ]);

      expect(mockQdrantClient.upsert).toHaveBeenCalledWith('ws_test', {
        points: [
          expect.objectContaining({
            id: 'abc-123',
            vector: [0.1, 0.2],
            payload: { workspaceId: 'ws1' },
          }),
        ],
        wait: true,
      });
    });
  });

  describe('search()', () => {
    it('should call qdrant search with correct parameters', async () => {
      mockQdrantClient.search.mockResolvedValueOnce([
        { id: '1', score: 0.95, payload: { content: 'hello' } },
      ]);

      const results = await service.search({
        collectionName: 'ws_test',
        vector: [0.1, 0.2],
        limit: 3,
        scoreThreshold: 0.8,
        withPayload: true,
      });

      expect(mockQdrantClient.search).toHaveBeenCalledWith(
        'ws_test',
        expect.objectContaining({ limit: 3, score_threshold: 0.8 }),
      );
      expect(results).toHaveLength(1);
    });
  });

  describe('healthCheck()', () => {
    it('should return true when qdrant responds', async () => {
      mockQdrantClient.getCollections.mockResolvedValueOnce({ collections: [] });
      expect(await service.healthCheck()).toBe(true);
    });

    it('should return false when qdrant throws', async () => {
      mockQdrantClient.getCollections.mockRejectedValueOnce(new Error('down'));
      expect(await service.healthCheck()).toBe(false);
    });
  });
});
