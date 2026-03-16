import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HeartbeatService } from './heartbeat.service';

/**
 * HealthModule
 *
 * NOTE: This module is NOT imported by OpenClawModule because the
 * HealthController and HeartbeatService are registered directly in
 * OpenClawModule's controllers/providers arrays (which also provide
 * AgentRegistryService and MessageRouterService).
 *
 * This module exists only as a self-contained unit for potential
 * standalone use or testing.  If imported into another module, the
 * consuming module must provide AgentRegistryService and
 * MessageRouterService.
 */
@Module({
  controllers: [HealthController],
  providers: [HeartbeatService],
})
export class HealthModule {}
