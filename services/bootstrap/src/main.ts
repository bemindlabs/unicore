import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 4500;

  app.enableCors();

  await app.listen(port);
  Logger.log(`Bootstrap service running on port ${port}`, 'Main');
}

bootstrap();
