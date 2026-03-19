import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const port = process.env.PORT || 4000;

  if (!process.env.DATABASE_URL) {
    logger.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  if (jwtSecret.includes('change-me')) {
    throw new Error('JWT_SECRET contains default placeholder — set a real secret');
  }

  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  const corsOrigins = [
    'https://unicore.bemind.tech',
    'http://unicore.bemind.tech',
    'http://localhost:3000',
  ];
  if (process.env.EXTRA_CORS_ORIGINS) {
    corsOrigins.push(...process.env.EXTRA_CORS_ORIGINS.split(',').map(s => s.trim()));
  }
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);
  logger.log(`API Gateway running on port ${port}`);
}

bootstrap();
