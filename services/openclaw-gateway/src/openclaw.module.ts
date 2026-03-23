import { Module } from '@nestjs/common';
import { OpenClawGateway } from './gateway/openclaw.gateway';
import { AgentRegistryService } from './registry/agent-registry.service';
import { MessageRouterService } from './routing/message-router.service';
import { RateLimiterService } from './routing/rate-limiter.service';
import { HeartbeatService } from './health/heartbeat.service';
import { HealthController } from './health/health.controller';
import { AgentsController } from './agents/agents.controller';
import { RouterModule } from './router/router.module';
import { PtySessionManager } from './terminal/pty-session-manager';
import { MessagePersistenceService } from './persistence/message-persistence.service';
import { MessagesController } from './messages/messages.controller';
import { HandoffNotifierService } from './handoff/handoff-notifier.service';

/**
 * OpenClawModule — WebSocket hub for multi-agent communication.
 *
 * Provides:
 *   - OpenClawGateway          : WebSocket server on port 18789
 *   - AgentRegistryService     : Agent registration and lifecycle management
 *   - MessageRouterService     : Pub/sub and direct message routing
 *   - HeartbeatService         : Heartbeat monitoring and stale-agent eviction
 *   - RouterModule             : Intent classification & task delegation (UNC-28)
 *   - MessagePersistenceService: Persist messages to PostgreSQL via Prisma
 *   - MessagesController       : GET /messages — paginated message history
 */
@Module({
  imports: [RouterModule],
  controllers: [HealthController, AgentsController, MessagesController],
  providers: [
    OpenClawGateway,
    AgentRegistryService,
    MessageRouterService,
    RateLimiterService,
    HeartbeatService,
    PtySessionManager,
    MessagePersistenceService,
  ],
  exports: [AgentRegistryService, MessageRouterService, RateLimiterService, MessagePersistenceService],
})
export class OpenClawModule {}
