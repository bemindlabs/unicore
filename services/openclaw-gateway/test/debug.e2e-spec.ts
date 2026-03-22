// Quick debug to check server.clients
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Module } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { WebSocketGateway } from '@nestjs/websockets';
import { WebSocket, Server } from 'ws';
import { v4 as uuidv4 } from 'uuid';

import { OpenClawGateway } from '../src/gateway/openclaw.gateway';
import { AgentRegistryService } from '../src/registry/agent-registry.service';
import { MessageRouterService } from '../src/routing/message-router.service';
import { RateLimiterService } from '../src/routing/rate-limiter.service';
import { HeartbeatService } from '../src/health/heartbeat.service';
import { HealthController } from '../src/health/health.controller';
import { RouterAgent } from '../src/router/router.agent';
import { PtySessionManager } from '../src/terminal/pty-session-manager';
import { MessagePersistenceService } from '../src/persistence/message-persistence.service';

const WS_PORT = 18799;
const HTTP_PORT = 18800;

@WebSocketGateway(WS_PORT, { path: '/', transports: ['websocket'] })
class TestGw extends OpenClawGateway {}

@Module({
  controllers: [HealthController],
  providers: [
    TestGw,
    AgentRegistryService,
    MessageRouterService,
    RateLimiterService,
    HeartbeatService,
    PtySessionManager,
    MessagePersistenceService,
    RouterAgent,
    { provide: OpenClawGateway, useExisting: TestGw },
  ],
})
class TestMod {}

describe('debug', () => {
  let app: INestApplication;
  
  beforeAll(async () => {
    process.env['HTTP_PORT'] = String(HTTP_PORT);
    process.env['HEARTBEAT_INTERVAL_MS'] = '60000';
    process.env['HEARTBEAT_TIMEOUT_MS'] = '120000';
    
    const mod = await Test.createTestingModule({ imports: [TestMod] })
      .overrideProvider(RouterAgent).useValue({ process: jest.fn(), onModuleInit: jest.fn() })
      .overrideProvider(PtySessionManager).useValue({ setSendFunction: jest.fn(), createSession: jest.fn(), writeInput: jest.fn(), resize: jest.fn(), destroySession: jest.fn(), destroyAllForSocket: jest.fn(), onModuleDestroy: jest.fn() })
      .overrideProvider(MessagePersistenceService).useValue({ save: jest.fn().mockResolvedValue(undefined), findByChannel: jest.fn().mockResolvedValue([]), findAfterMessageId: jest.fn().mockResolvedValue([]), onModuleInit: jest.fn(), onModuleDestroy: jest.fn() })
      .compile();
    
    app = mod.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(HTTP_PORT);
    await new Promise(r => setTimeout(r, 200));
  });

  afterAll(async () => { await app.close(); });

  it('check server.clients', async () => {
    const gw = app.get(TestGw);
    const server = (gw as any).server as Server;
    console.log('server type:', typeof server);
    console.log('server.clients type:', typeof server?.clients);
    console.log('server.clients size before connect:', server?.clients?.size);

    const ws1 = new WebSocket(`ws://localhost:${WS_PORT}`);
    await new Promise<void>((resolve) => ws1.once('open', resolve));
    
    const ws2 = new WebSocket(`ws://localhost:${WS_PORT}`);
    await new Promise<void>((resolve) => ws2.once('open', resolve));
    
    await new Promise(r => setTimeout(r, 100));
    
    console.log('server.clients size after 2 connects:', server?.clients?.size);
    
    // Try iterating
    server?.clients?.forEach((client: any) => {
      console.log('client socketId:', client.socketId, 'readyState:', client.readyState);
    });

    ws1.close();
    ws2.close();
  });
});
