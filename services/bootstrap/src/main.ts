import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 4500;

  const swaggerConfig = new DocumentBuilder()
    .setTitle('UniCore Bootstrap')
    .setDescription('Wizard setup, initial provisioning, and template management')
    .setVersion('0.1.1')
    .addTag('wizard', 'Setup wizard status and step management')
    .addTag('provisioning', 'Initial system provisioning and configuration')
    .addTag('templates', 'Pre-built workspace templates')
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
  Logger.log(`Bootstrap service running on port ${port}`, 'Main');
}

bootstrap();
