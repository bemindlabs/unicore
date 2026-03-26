import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';
import { buildKafkaOptions } from './kafka/config/kafka.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('UniCore Workflow')
    .setDescription('Kafka-based workflow engine — templates, execution, and dead-letter queue')
    .setVersion('0.1.1')
    .addBearerAuth()
    .addTag('workflows', 'Workflow execution and management')
    .addTag('templates', 'Workflow template library')
    .addTag('dlq', 'Dead-letter queue — failed event inspection and replay')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  app.use('/docs', apiReference({ spec: { content: swaggerDocument }, theme: 'kepler' }));
  SwaggerModule.setup('swagger', app, swaggerDocument);

  // Attach the Kafka microservice transport for all ERP topic consumers.
  app.connectMicroservice(buildKafkaOptions());

  // Start all microservice listeners before accepting HTTP traffic.
  await app.startAllMicroservices();

  const port = Number(process.env['PORT'] ?? 4400);
  await app.listen(port);

  Logger.log(`Workflow service running on port ${port}`, 'Main');
  Logger.log('Kafka consumer active — subscribed to all ERP topics', 'Main');
}

bootstrap().catch((err: unknown) => {
  Logger.error('Fatal error during bootstrap', err, 'Main');
  process.exit(1);
});
