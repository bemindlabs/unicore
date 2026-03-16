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
  if (!jwtSecret) {
    logger.error('JWT_SECRET environment variable is required');
    process.exit(1);
  }
  if (jwtSecret === 'change-me-in-production') {
    if (process.env.NODE_ENV === 'production') {
      logger.error('JWT_SECRET must not be the placeholder value in production');
      process.exit(1);
    }
    logger.warn('JWT_SECRET is set to placeholder value — change before deploying');
  }
  if (jwtSecret.length < 32) {
    logger.warn(`JWT_SECRET is only ${jwtSecret.length} chars — 32+ recommended`);
  }

  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.enableCors({
    origin: [
      'https://unicore.bemind.tech',
      'http://unicore.bemind.tech',
      'http://76.13.188.164:3000',
      'http://localhost:3000',
    ],
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
