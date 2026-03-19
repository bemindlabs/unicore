import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getKafkaConfig } from './kafka/kafka.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  const logger = new Logger('ERP Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global prefix for all ERP routes
  app.setGlobalPrefix('api/v1');

  // Global validation pipe — strip unknown properties, whitelist known ones
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter and logging interceptor
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Start HTTP server first — ERP must be available even without Kafka
  const port = process.env['PORT'] ?? 4100;
  await app.listen(port);
  logger.log(`ERP service listening on port ${port}`);

  // Connect Kafka microservice consumer in background (optional — workflows profile)
  const kafkaEnabled = process.env['ENABLE_KAFKA'] === 'true';
  if (kafkaEnabled) {
    try {
      app.connectMicroservice(getKafkaConfig());
      await app.startAllMicroservices();
      logger.log('Kafka microservice connected');
    } catch (err) {
      logger.warn(`Kafka unavailable — running without workflow events: ${(err as Error).message}`);
    }
  } else {
    logger.log('Kafka disabled (set ENABLE_KAFKA=true to enable)');
  }
}

void bootstrap();
