import { Module } from '@nestjs/common';
import { QdrantModule } from '../qdrant/qdrant.module';
import { HealthController } from './health.controller';

@Module({
  imports: [QdrantModule],
  controllers: [HealthController],
})
export class HealthModule {}
