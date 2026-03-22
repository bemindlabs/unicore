import { Module } from '@nestjs/common';
import { OpenClawGateway } from './gateway/openclaw.gateway';
import { AgentRegistryService } from './registry/agent-registry.service';
import { MessageRouterService } from './routing/message-router.service';
import { HeartbeatService } from './health/heartbeat.service';
import { HealthController } from './health/health.controller';
import { AgentsController } from './agents/agents.controller';
import { RouterModule } from './router/router.module';
import { PtySessionManager } from './terminal/pty-session-manager';

/**
 * OpenClawModule — WebSocket hub for multi-agent communication.
 *
 * Provides:
 *   - OpenClawGateway     : WebSocket server on port 18789
 *   - AgentRegistryService: Agent registration and lifecycle management
 *   - MessageRouterService: Pub/sub and direct message routing
 *   - HeartbeatService    : Heartbeat monitoring and stale-agent eviction
 *   - RouterModule        : Intent classification & task delegation (UNC-28)
 */
@Module({
  imports: [RouterModule],
  controllers: [HealthController, AgentsController],
  providers: [
    OpenClawGateway,
    AgentRegistryService,
    MessageRouterService,
    HeartbeatService,
  ],
  exports: [AgentRegistryService, MessageRouterService],
})
export class OpenClawModule {}
