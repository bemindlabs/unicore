import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const httpPort = parseInt(process.env['HTTP_PORT'] ?? '18790', 10);

  const app = await NestFactory.create(AppModule);

  // Use the native ws adapter so @WebSocketGateway binds on its own port (18789)
  app.useWebSocketAdapter(new WsAdapter(app));

  app.enableCors();

  // HTTP server for health checks runs on a separate port
  await app.listen(httpPort);

  logger.log(`OpenClaw Gateway HTTP health server running on port ${httpPort}`);
  logger.log('OpenClaw Gateway WebSocket hub running on ws://localhost:18789');
}

bootstrap();
