import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { MessageRouterService } from '../routing/message-router.service';
import { HeartbeatService } from './heartbeat.service';

@Module({
  controllers: [HealthController],
  providers: [AgentRegistryService, MessageRouterService, HeartbeatService],
})
export class HealthModule {}
