import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { buildKafkaOptions } from './kafka/config/kafka.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

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
