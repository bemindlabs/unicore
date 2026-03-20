import { Module } from '@nestjs/common';
import { QdrantModule } from '../qdrant/qdrant.module';
import { IngestionService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding.service';
import { GitRepoIngestor } from '../ingest/git-repo.ingestor';
import { GitCloneService } from '../git-ingestion/git-clone.service';
import { CodeChunkerService } from '../git/chunker.service';

@Module({
  imports: [QdrantModule],
  providers: [IngestionService, ChunkingService, EmbeddingService, GitRepoIngestor, GitCloneService, CodeChunkerService],
  controllers: [IngestionController],
  exports: [IngestionService, EmbeddingService, ChunkingService, GitRepoIngestor],
})
export class IngestionModule {}
