import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { buildKafkaOptions } from './kafka/config/kafka.config';

const logger = new Logger('WorkflowBootstrap');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Attach the Kafka microservice transport.
  app.connectMicroservice(buildKafkaOptions());

  // Start all microservice listeners before accepting HTTP traffic.
  await app.startAllMicroservices();

  const port = Number(process.env['PORT'] ?? 4400);
  await app.listen(port);

  logger.log(`Workflow service listening on port ${port}`);
  logger.log('Kafka consumer active — subscribed to all ERP topics');
  logger.log('Pre-built workflow templates loaded and registered');
}

bootstrap().catch((err: unknown) => {
  logger.error('Fatal error during bootstrap', err);
  process.exit(1);
});
