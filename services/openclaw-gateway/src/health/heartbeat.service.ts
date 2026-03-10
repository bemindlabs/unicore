import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { MessageRouterService } from '../routing/message-router.service';
import { MessageSender } from '../routing/message-router.service';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 90_000;

@Injectable()
export class HeartbeatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HeartbeatService.name);

  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private sendFn: MessageSender | null = null;

  private readonly heartbeatIntervalMs: number;
  private readonly heartbeatTimeoutMs: number;

  constructor(
    private readonly registry: AgentRegistryService,
    private readonly router: MessageRouterService,
  ) {
    this.heartbeatIntervalMs =
      parseInt(process.env['HEARTBEAT_INTERVAL_MS'] ?? '', 10) ||
      DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.heartbeatTimeoutMs =
      parseInt(process.env['HEARTBEAT_TIMEOUT_MS'] ?? '', 10) ||
      DEFAULT_HEARTBEAT_TIMEOUT_MS;
  }

  onModuleInit(): void {
    this.intervalHandle = setInterval(
      () => this.checkHeartbeats(),
      this.heartbeatIntervalMs,
    );
    this.logger.log(
      `Heartbeat monitor started (interval=${this.heartbeatIntervalMs}ms, timeout=${this.heartbeatTimeoutMs}ms)`,
    );
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.log('Heartbeat monitor stopped');
  }

  /** Called by the gateway to provide a send function after the WS server starts */
  setSendFunction(fn: MessageSender): void {
    this.sendFn = fn;
  }

  private checkHeartbeats(): void {
    const stale = this.registry.getStaleAgents(this.heartbeatTimeoutMs);

    for (const agent of stale) {
      const agentId = agent.metadata.id;
      const elapsed = Date.now() - agent.lastHeartbeatAt.getTime();

      this.logger.warn(
        `Agent ${agentId} missed heartbeat (${elapsed}ms > ${this.heartbeatTimeoutMs}ms) — marking terminated`,
      );

      // Notify agent if still reachable
      if (this.sendFn) {
        try {
          const errMsg = JSON.stringify({
            type: 'system:error',
            messageId: uuidv4(),
            timestamp: new Date().toISOString(),
            payload: {
              code: 'HEARTBEAT_TIMEOUT',
              message: `Agent ${agentId} timed out after ${elapsed}ms without heartbeat`,
            },
          });
          this.router.routeDirect(agentId, errMsg, this.sendFn);
        } catch {
          // Socket may be gone; ignore
        }
      }

      this.registry.updateState(agentId, 'terminated');
      this.router.unsubscribeAll(agentId);
    }
  }

  getStatus() {
    return {
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      heartbeatTimeoutMs: this.heartbeatTimeoutMs,
      running: this.intervalHandle !== null,
    };
  }
}
