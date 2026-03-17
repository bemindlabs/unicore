import { Controller, Get, Post, Body, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { MessageRouterService } from '../routing/message-router.service';
import { HeartbeatService } from './heartbeat.service';
import type { AgentCapability } from '../registry/interfaces/agent.interface';

const DEFAULT_AGENTS = [
  { id: 'router', name: 'ROUTER', type: 'router', capabilities: ['routing', 'delegation', 'intent-classification'] },
  { id: 'comms', name: 'COMMS', type: 'comms', capabilities: ['messaging', 'email', 'notifications'] },
  { id: 'finance', name: 'FINANCE', type: 'finance', capabilities: ['invoicing', 'expenses', 'reports'] },
  { id: 'growth', name: 'GROWTH', type: 'growth', capabilities: ['marketing', 'analytics', 'campaigns'] },
  { id: 'ops', name: 'OPS', type: 'ops', capabilities: ['monitoring', 'deployment', 'system-health'] },
  { id: 'research', name: 'RESEARCH', type: 'research', capabilities: ['market-research', 'analysis', 'trends'] },
  { id: 'sentinel', name: 'SENTINEL', type: 'security', capabilities: ['security-scan', 'threat-detection'] },
  { id: 'builder', name: 'BUILDER', type: 'builder', capabilities: ['code-generation', 'feature-building'] },
  { id: 'erp', name: 'ERP', type: 'erp', capabilities: ['data-entry', 'workflow-automation'] },
];

@Controller('health')
export class HealthController implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly registry: AgentRegistryService,
    private readonly router: MessageRouterService,
    private readonly heartbeat: HeartbeatService,
  ) {}

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  onModuleInit() {
    for (const d of DEFAULT_AGENTS) {
      try {
        const capabilities: AgentCapability[] = d.capabilities.map((c) => ({
          name: c,
          version: '1.0.0',
        }));
        this.registry.register(
          { id: d.id, name: d.name, type: d.type, version: '1.0.0', capabilities, tags: [] },
          `default-${d.id}`,
        );
      } catch {
        /* already registered */
      }
    }
    this.logger.log(`Registered ${DEFAULT_AGENTS.length} default agents on startup`);

    // Keep built-in agents alive by sending periodic heartbeats
    this.heartbeatInterval = setInterval(() => {
      for (const d of DEFAULT_AGENTS) {
        try {
          this.registry.recordHeartbeat(d.id);
        } catch {
          /* agent may have been removed */
        }
      }
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

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

  @Post('agents/register')
  registerAgent(@Body() body: { agentId: string; name: string; type: string; capabilities?: string[] }) {
    const capabilities: AgentCapability[] = (body.capabilities ?? []).map((c) => ({
      name: c,
      version: '1.0.0',
    }));
    const metadata = {
      id: body.agentId,
      name: body.name,
      type: body.type,
      version: '1.0.0',
      capabilities,
      tags: [] as string[],
    };
    const agent = this.registry.register(metadata, `http-${body.agentId}`);
    return { ok: true, agent: { id: agent.metadata.id, name: agent.metadata.name, state: agent.state } };
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
