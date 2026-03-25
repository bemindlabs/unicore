import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const httpPort = parseInt(process.env['HTTP_PORT'] ?? '18790', 10);

  const app = await NestFactory.create(AppModule);

  // Use the native ws adapter so @WebSocketGateway binds on its own port (18789)
  app.useWebSocketAdapter(new WsAdapter(app));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('UniCore OpenClaw Gateway')
    .setDescription('Multi-agent WebSocket gateway — agent registration, messaging, and terminal')
    .setVersion('0.1.1')
    .addBearerAuth()
    .addTag('agents', 'Agent registration and management')
    .addTag('messages', 'Agent-to-agent and agent-to-user messaging')
    .addTag('terminal', 'Terminal and tmux session management')
    .addTag('health', 'Health check')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  app.use('/docs', apiReference({ spec: { content: swaggerDocument }, theme: 'kepler' }));
  SwaggerModule.setup('swagger', app, swaggerDocument);

  app.enableCors();

  // HTTP server for health checks runs on a separate port
  await app.listen(httpPort);

  logger.log(`OpenClaw Gateway HTTP health server running on port ${httpPort}`);
  logger.log('OpenClaw Gateway WebSocket hub running on ws://localhost:18789');
}

bootstrap();
