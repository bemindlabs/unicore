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

  // Connect Kafka microservice consumer (optional — workflows profile)
  const kafkaBrokers = process.env['KAFKA_BROKERS'];
  if (kafkaBrokers) {
    try {
      app.connectMicroservice(getKafkaConfig());
      await app.startAllMicroservices();
      logger.log('Kafka microservice connected');
    } catch (err) {
      logger.warn(`Kafka unavailable — running without workflow events: ${(err as Error).message}`);
    }
  } else {
    logger.log('KAFKA_BROKERS not set — running without Kafka');
  }

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

  const port = process.env['PORT'] ?? 4100;
  await app.listen(port);
  logger.log(`ERP service listening on port ${port}`);
}

void bootstrap();
