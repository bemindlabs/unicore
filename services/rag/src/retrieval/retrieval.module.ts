import { Module } from '@nestjs/common';
import { QdrantModule } from '../qdrant/qdrant.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { RetrievalService } from './retrieval.service';
import { RetrievalController } from './retrieval.controller';

@Module({
  imports: [QdrantModule, IngestionModule],
  providers: [RetrievalService],
  controllers: [RetrievalController],
  exports: [RetrievalService],
})
export class RetrievalModule {}
