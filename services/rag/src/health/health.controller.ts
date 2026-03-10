import { Controller, Get } from '@nestjs/common';
import { QdrantService } from '../qdrant/qdrant.service';

@Controller('health')
export class HealthController {
  constructor(private readonly qdrant: QdrantService) {}

  @Get()
  async check() {
    const qdrantOk = await this.qdrant.healthCheck();
    const status = qdrantOk ? 'ok' : 'degraded';

    return {
      status,
      service: '@unicore/rag',
      timestamp: new Date().toISOString(),
      checks: {
        qdrant: qdrantOk ? 'ok' : 'unreachable',
      },
    };
  }
}
