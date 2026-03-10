import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { RagModule } from './rag.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = process.env['PORT'] ?? 4002;

  if (!process.env['QDRANT_URL']) {
    logger.warn('QDRANT_URL not set, defaulting to http://localhost:6333');
  }

  const app = await NestFactory.create(RagModule);

  app.use(helmet());

  app.enableCors();

  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);
  logger.log(`RAG Service running on port ${port}`);
}

bootstrap();
