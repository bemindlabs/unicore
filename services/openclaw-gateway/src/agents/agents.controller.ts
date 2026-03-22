import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { RateLimiterService } from '../routing/rate-limiter.service';
import type { AgentCapability } from '../registry/interfaces/agent.interface';

@Controller('agents')
export class AgentsController {
  private readonly logger = new Logger(AgentsController.name);

  constructor(
    private readonly registry: AgentRegistryService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  @Get()
  list() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      ...this.registry.getSummary(),
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const agent = this.registry.getAgent(id);
    if (!agent) {
      throw new NotFoundException(`Agent '${id}' not found`);
    }
    return {
      id: agent.metadata.id,
      name: agent.metadata.name,
      type: agent.metadata.type,
      version: agent.metadata.version,
      state: agent.state,
      capabilities: agent.metadata.capabilities.map((c) => c.name),
      tags: agent.metadata.tags ?? [],
      registeredAt: agent.registeredAt,
      lastHeartbeatAt: agent.lastHeartbeatAt,
    };
  }

  @Post()
  create(
    @Body()
    body: {
      id?: string;
      agentId?: string;
      name: string;
      type: string;
      capabilities?: string[];
      tags?: string[];
    },
  ) {
    const agentId = body.id ?? body.agentId ?? body.name.toLowerCase().replace(/\s+/g, '-');
    const capabilities: AgentCapability[] = (body.capabilities ?? []).map(
      (c) => ({ name: c, version: '1.0.0' }),
    );
    const metadata = {
      id: agentId,
      name: body.name,
      type: body.type,
      version: '1.0.0',
      capabilities,
      tags: body.tags ?? [],
    };
    const agent = this.registry.register(metadata, `http-${agentId}`);
    this.logger.log(`Agent created via REST: ${agentId}`);
    return {
      ok: true,
      agent: {
        id: agent.metadata.id,
        name: agent.metadata.name,
        type: agent.metadata.type,
        state: agent.state,
      },
    };
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      role?: string;
      type?: string;
      status?: string;
      state?: string;
      capabilities?: string[];
      tags?: string[];
      activity?: string;
      [key: string]: unknown;
    },
  ) {
    const agent = this.registry.getAgent(id);
    if (!agent) {
      throw new NotFoundException(`Agent '${id}' not found`);
    }

    // Update metadata fields
    if (body.name) agent.metadata.name = body.name;
    if (body.type) agent.metadata.type = body.type;
    if (body.tags) agent.metadata.tags = body.tags;
    if (body.capabilities) {
      agent.metadata.capabilities = body.capabilities.map((c) => ({
        name: c,
        version: '1.0.0',
      }));
    }

    // Update state if provided (status or state field)
    const newState = body.status ?? body.state;
    if (newState) {
      const stateMap: Record<string, string> = {
        working: 'running',
        running: 'running',
        idle: 'idle',
        offline: 'terminated',
        terminated: 'terminated',
        spawning: 'spawning',
      };
      const mapped = stateMap[newState] ?? 'running';
      this.registry.updateState(
        id,
        mapped as 'spawning' | 'running' | 'idle' | 'terminated',
      );
    }

    this.logger.log(`Agent updated via REST: ${id}`);

    return {
      ok: true,
      agent: {
        id: agent.metadata.id,
        name: agent.metadata.name,
        type: agent.metadata.type,
        state: agent.state,
        capabilities: agent.metadata.capabilities.map((c) => c.name),
        tags: agent.metadata.tags ?? [],
      },
    };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    const agent = this.registry.getAgent(id);
    if (!agent) {
      throw new NotFoundException(`Agent '${id}' not found`);
    }

    this.registry.unregister(id, 'deleted via REST');
    this.logger.log(`Agent deleted via REST: ${id}`);

    return { ok: true, deleted: id };
  }
}
