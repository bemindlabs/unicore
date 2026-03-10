import { Controller, Get } from '@nestjs/common';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { MessageRouterService } from '../routing/message-router.service';
import { HeartbeatService } from './heartbeat.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly registry: AgentRegistryService,
    private readonly router: MessageRouterService,
    private readonly heartbeat: HeartbeatService,
  ) {}

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'openclaw-gateway',
      port: 18789,
    };
  }

  @Get('agents')
  agents() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      ...this.registry.getSummary(),
    };
  }

  @Get('channels')
  channels() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      channels: this.router.getAllChannels(),
    };
  }

  @Get('heartbeat')
  heartbeatStatus() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      heartbeat: this.heartbeat.getStatus(),
    };
  }
}
