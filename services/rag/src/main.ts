import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { RagModule } from './rag.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = process.env['PORT'] ?? 4300;

  if (!process.env['QDRANT_URL']) {
    logger.warn('QDRANT_URL not set, defaulting to http://localhost:6333');
  }

  const app = await NestFactory.create(RagModule);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('UniCore RAG')
    .setDescription('Vector search, document ingestion, and retrieval-augmented generation')
    .setVersion('0.1.1')
    .addBearerAuth()
    .addTag('ingestion', 'Document ingestion — upload, chunk, embed, and index')
    .addTag('retrieval', 'Semantic search and context retrieval')
    .addTag('git', 'Git repository ingestion and code search')
    .addTag('health', 'Health check')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  app.use('/docs', apiReference({ spec: { content: swaggerDocument }, theme: 'kepler' }));
  SwaggerModule.setup('swagger', app, swaggerDocument);

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
