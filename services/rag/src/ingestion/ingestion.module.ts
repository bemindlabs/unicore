import { Module } from '@nestjs/common';
import { QdrantModule } from '../qdrant/qdrant.module';
import { IngestionService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding.service';

@Module({
  imports: [QdrantModule],
  providers: [IngestionService, ChunkingService, EmbeddingService],
  controllers: [IngestionController],
  exports: [IngestionService, EmbeddingService, ChunkingService],
})
export class IngestionModule {}
