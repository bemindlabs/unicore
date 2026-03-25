import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
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

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", 'https://*.bemind.tech', 'wss://*.bemind.tech'],
          fontSrc: ["'self'", 'https:', 'data:'],
          imgSrc: ["'self'", 'data:'],
          styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
        },
      },
    }),
  );

  const corsOrigins: (string | RegExp)[] = [
    /\.bemind\.tech$/,
    'http://localhost:3000',
    'http://localhost:3100',
    'http://localhost:3200',
    'http://localhost:3300',
    'http://localhost:3400',
  ];
  if (process.env.EXTRA_CORS_ORIGINS) {
    corsOrigins.push(...process.env.EXTRA_CORS_ORIGINS.split(',').map(s => s.trim()));
  }
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Tenant-Id'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 86400,
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
