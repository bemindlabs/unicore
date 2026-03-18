import { Module } from '@nestjs/common';
import { QdrantModule } from '../qdrant/qdrant.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { GitCloneService } from '../git-ingestion/git-clone.service';
import { CodeChunkerService } from './chunker.service';
import { GitIngestionService } from './git-ingestion.service';
import { GitController } from './git.controller';

@Module({
  imports: [QdrantModule, IngestionModule],
  providers: [GitCloneService, CodeChunkerService, GitIngestionService],
  controllers: [GitController],
})
export class GitModule {}
