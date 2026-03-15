import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getKafkaConfig } from './kafka/kafka.config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('ERP Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Connect Kafka microservice consumer
  app.connectMicroservice(getKafkaConfig());

  // Global validation pipe — strip unknown properties, whitelist known ones
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );


  await app.startAllMicroservices();

  const port = process.env['PORT'] ?? 4100;
  await app.listen(port);
  logger.log(`ERP service listening on port ${port}`);
}

void bootstrap();
