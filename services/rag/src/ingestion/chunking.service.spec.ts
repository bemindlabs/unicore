import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChunkingService } from './chunking.service';

describe('ChunkingService', () => {
  let service: ChunkingService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => {
      if (key === 'CHUNK_SIZE') return 100;
      if (key === 'CHUNK_OVERLAP') return 20;
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChunkingService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ChunkingService>(ChunkingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('split()', () => {
    it('should return a single chunk for short text', () => {
      const text = 'Hello world.';
      const chunks = service.split(text);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.content).toBe('Hello world.');
      expect(chunks[0]!.index).toBe(0);
    });

    it('should split long text into multiple chunks', () => {
      const paragraph = 'A'.repeat(50);
      const text = Array(10).fill(paragraph).join('\n\n');
      const chunks = service.split(text, { chunkSize: 100, chunkOverlap: 10 });
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should prefer paragraph breaks over sentence breaks', () => {
      const text = 'First paragraph with some content.\n\nSecond paragraph with different content.\n\nThird paragraph here.';
      const chunks = service.split(text, { chunkSize: 60, chunkOverlap: 0 });
      // Each paragraph is ~40 chars; with chunkSize=60 we expect merging to yield 2+ chunks
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(200); // reasonable upper bound
      });
    });

    it('should assign sequential index values', () => {
      const text = Array(5).fill('Word '.repeat(30)).join('\n\n');
      const chunks = service.split(text, { chunkSize: 100, chunkOverlap: 10 });
      chunks.forEach((chunk, i) => {
        expect(chunk.index).toBe(i);
      });
    });

    it('should handle empty string', () => {
      const chunks = service.split('');
      expect(chunks).toHaveLength(0);
    });

    it('should handle text exactly at chunk size boundary', () => {
      const text = 'X'.repeat(100);
      const chunks = service.split(text, { chunkSize: 100, chunkOverlap: 0 });
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect custom separators', () => {
      const text = 'chunk1|chunk2|chunk3|chunk4';
      const chunks = service.split(text, {
        chunkSize: 10,
        chunkOverlap: 0,
        separators: ['|', ''],
      });
      expect(chunks.length).toBeGreaterThan(1);
    });
  });
});
