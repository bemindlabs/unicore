/**
 * TmuxManager — Agent-oriented tmux session manager.
 *
 * Wraps TmuxService with agent-scoped session lifecycle management.
 * Each agent gets a namespaced tmux session that it can use to spawn
 * terminal sessions, send commands, and capture output.
 *
 * Integrates with AgentRegistryService to auto-cleanup sessions when
 * agents are unregistered.
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { TmuxService } from './tmux.service';
import { AgentRegistryService } from '../registry/agent-registry.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentSession {
  sessionName: string;
  agentId: string;
  createdAt: Date;
  lastCommandAt: Date;
}

export interface SendCommandResult {
  ok: boolean;
  output?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class TmuxManager implements OnModuleDestroy {
  private readonly logger = new Logger(TmuxManager.name);

  /** agentId -> sessionName mapping (one session per agent) */
  private readonly agentSessions = new Map<string, AgentSession>();

  constructor(
    private readonly tmux: TmuxService,
    private readonly agentRegistry: AgentRegistryService,
  ) {}

  onModuleDestroy() {
    // Kill all agent sessions on shutdown
    for (const session of this.agentSessions.values()) {
      void this.tmux.killSession(session.sessionName).catch(() => {});
    }
    this.agentSessions.clear();
  }

  /**
   * Creates a tmux session for an agent. If the agent already has a session,
   * returns the existing one.
   *
   * @param agentId  The agent requesting a terminal session
   * @param name     Optional custom session name suffix
   */
  async createSession(
    agentId: string,
    name?: string,
  ): Promise<{ ok: boolean; sessionName: string; error?: string }> {
    // Verify agent exists
    const agent = this.agentRegistry.getAgent(agentId);
    if (!agent) {
      return { ok: false, sessionName: '', error: `Agent ${agentId} not registered` };
    }

    // Check for existing session
    const existing = this.agentSessions.get(agentId);
    if (existing) {
      return { ok: true, sessionName: existing.sessionName };
    }

    // Build namespaced session name: agent-<agentId>[-<name>]
    const suffix = name ? `-${this.sanitize(name)}` : '';
    const sessionName = `agent-${this.sanitize(agentId)}${suffix}`;

    const result = await this.tmux.createSession(sessionName);
    if (!result.ok) {
      return { ok: false, sessionName, error: result.error };
    }

    const session: AgentSession = {
      sessionName,
      agentId,
      createdAt: new Date(),
      lastCommandAt: new Date(),
    };

    this.agentSessions.set(agentId, session);

    this.logger.log(`Created tmux session '${sessionName}' for agent ${agentId}`);

    return { ok: true, sessionName };
  }

  /**
   * Sends a command to an agent's tmux session and captures the output.
   *
   * @param agentId  The agent whose session to send to
   * @param command  The shell command to execute
   * @param captureDelayMs  Delay before capturing output (default: 500ms)
   */
  async sendCommand(
    agentId: string,
    command: string,
    captureDelayMs = 500,
  ): Promise<SendCommandResult> {
    const session = this.agentSessions.get(agentId);
    if (!session) {
      return { ok: false, error: `No active session for agent ${agentId}` };
    }

    const result = await this.tmux.execInSession(session.sessionName, command);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    session.lastCommandAt = new Date();

    // Wait for output
    await new Promise((r) => setTimeout(r, captureDelayMs));

    const output = await this.captureOutput(agentId);
    return { ok: true, output };
  }

  /**
   * Captures the current pane output from an agent's tmux session.
   */
  async captureOutput(agentId: string): Promise<string> {
    const session = this.agentSessions.get(agentId);
    if (!session) return '';

    return this.tmux.captureOutput(session.sessionName);
  }

  /**
   * Lists all active agent tmux sessions.
   */
  listSessions(): AgentSession[] {
    return Array.from(this.agentSessions.values());
  }

  /**
   * Kills an agent's tmux session and cleans up the mapping.
   */
  async killSession(agentId: string): Promise<{ ok: boolean; error?: string }> {
    const session = this.agentSessions.get(agentId);
    if (!session) {
      return { ok: false, error: `No active session for agent ${agentId}` };
    }

    const result = await this.tmux.killSession(session.sessionName);
    this.agentSessions.delete(agentId);

    this.logger.log(`Killed tmux session '${session.sessionName}' for agent ${agentId}`);

    return result;
  }

  /**
   * Cleans up all sessions belonging to agents that are no longer registered.
   * Called by heartbeat or on agent disconnect.
   */
  async cleanupOrphanedSessions(): Promise<number> {
    let cleaned = 0;

    for (const [agentId, session] of this.agentSessions) {
      const agent = this.agentRegistry.getAgent(agentId);
      if (!agent || agent.state === 'terminated') {
        await this.tmux.killSession(session.sessionName).catch(() => {});
        this.agentSessions.delete(agentId);
        cleaned++;
        this.logger.log(
          `Cleaned up orphaned session '${session.sessionName}' (agent ${agentId})`,
        );
      }
    }

    return cleaned;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private sanitize(s: string): string {
    return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
  }
}
