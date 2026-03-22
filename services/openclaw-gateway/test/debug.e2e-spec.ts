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

describe('debug direct msg', () => {
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

  it('direct message delivery', async () => {
    const gw = app.get(TestGw);
    const registry = app.get(AgentRegistryService);
    const server = (gw as any).server as Server;

    // Connect two clients
    const ws1 = new WebSocket(`ws://localhost:${WS_PORT}`);
    await new Promise<void>((resolve) => ws1.once('open', resolve));
    const ws2 = new WebSocket(`ws://localhost:${WS_PORT}`);
    await new Promise<void>((resolve) => ws2.once('open', resolve));
    await new Promise(r => setTimeout(r, 50));

    console.log('clients count:', server.clients.size);
    
    // Find socketIds assigned by afterInit
    const socketIds: string[] = [];
    server.clients.forEach((c: any) => {
      socketIds.push(c.socketId);
      console.log('socket', c.socketId, 'readyState', c.readyState);
    });

    // Register agent on ws1
    const regMsg1 = { type: 'agent:register', messageId: uuidv4(), timestamp: new Date().toISOString(), payload: { agentId: 'sender', name: 'S', agentType: 'w', version: '1', capabilities: [] } };
    ws1.send(JSON.stringify(regMsg1));
    const ack1Data = await new Promise<string>((resolve) => ws1.once('message', (d: any) => resolve(d.toString())));
    console.log('reg1 ack:', ack1Data);

    const regMsg2 = { type: 'agent:register', messageId: uuidv4(), timestamp: new Date().toISOString(), payload: { agentId: 'receiver', name: 'R', agentType: 'w', version: '1', capabilities: [] } };
    ws2.send(JSON.stringify(regMsg2));
    const ack2Data = await new Promise<string>((resolve) => ws2.once('message', (d: any) => resolve(d.toString())));
    console.log('reg2 ack:', ack2Data);

    // Check registry
    const senderAgent = registry.getAgent('sender');
    const receiverAgent = registry.getAgent('receiver');
    console.log('sender socketId in registry:', senderAgent?.socketId);
    console.log('receiver socketId in registry:', receiverAgent?.socketId);

    // Check if receiver socketId matches any socket in server.clients
    let found = false;
    server.clients.forEach((c: any) => {
      if (c.socketId === receiverAgent?.socketId) {
        found = true;
        console.log('MATCH: receiver socket found in server.clients');
      }
    });
    console.log('receiver socket found:', found);

    // Send direct message
    const directMsg = {
      type: 'message:direct',
      messageId: uuidv4(),
      timestamp: new Date().toISOString(),
      payload: { fromAgentId: 'sender', toAgentId: 'receiver', topic: 'test', data: { hello: true } },
    };
    
    // Listen on ws2 before sending
    const receiverPromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 2000);
      ws2.once('message', (d: any) => { clearTimeout(timer); resolve(d.toString()); });
    });

    ws1.send(JSON.stringify(directMsg));
    
    // Wait for ack on sender
    const senderAck = await new Promise<string>((resolve) => ws1.once('message', (d: any) => resolve(d.toString())));
    console.log('sender ack:', senderAck);

    try {
      const receiverMsg = await receiverPromise;
      console.log('receiver got:', receiverMsg);
    } catch (e) {
      console.log('receiver TIMED OUT - message not delivered');
    }

    ws1.close();
    ws2.close();
  });
});
