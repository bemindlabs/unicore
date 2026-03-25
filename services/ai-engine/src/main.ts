import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AiEngineModule } from './ai-engine.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = process.env.PORT ?? 4200;

  const app = await NestFactory.create(AiEngineModule);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('UniCore AI Engine')
    .setDescription('LLM provider orchestration, prompt management, and token tracking')
    .setVersion('0.1.1')
    .addBearerAuth()
    .addTag('llm', 'LLM inference — chat completions, streaming, provider selection')
    .addTag('prompts', 'Prompt templates and versioning')
    .addTag('token-tracking', 'Token usage and cost tracking')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  app.use('/docs', apiReference({ spec: { content: swaggerDocument }, theme: 'kepler' }));
  SwaggerModule.setup('swagger', app, swaggerDocument);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  await app.listen(port);
  logger.log(`AI Engine running on port ${port}`);
}

bootstrap();
