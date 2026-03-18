import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const MAX_OUTPUT = 64 * 1024;
const STALE_SESSION_MS = 60 * 60 * 1000; // 1 hour

export interface TmuxSession {
  name: string;
  windows: number;
  created: number;
  lastActivity: number;
}

@Injectable()
export class TmuxService implements OnModuleInit {
  private readonly logger = new Logger(TmuxService.name);
  private readonly sessions = new Map<string, TmuxSession>();
  private cleanupInterval: NodeJS.Timeout;

  onModuleInit() {
    this.cleanupInterval = setInterval(() => this.cleanupStaleSessions(), 10 * 60 * 1000);
  }

  private async run(cmd: string): Promise<{ stdout: string; stderr: string }> {
    try {
      return await execAsync(cmd, {
        env: { ...process.env, TERM: 'xterm-256color' },
        maxBuffer: MAX_OUTPUT,
        timeout: 15_000,
      });
    } catch (err: any) {
      return { stdout: err.stdout ?? '', stderr: err.stderr ?? err.message ?? '' };
    }
  }

  async createSession(name: string): Promise<{ ok: boolean; error?: string }> {
    const { stderr } = await this.run(`tmux new-session -d -s ${name}`);
    if (stderr && !stderr.includes('duplicate session')) {
      return { ok: false, error: stderr.trim() };
    }
    const now = Date.now();
    this.sessions.set(name, { name, windows: 1, created: now, lastActivity: now });
    this.logger.log(`Created tmux session: ${name}`);
    return { ok: true };
  }

  async execInSession(name: string, command: string, pane = 0): Promise<{ ok: boolean; error?: string }> {
    const target = `${name}:0.${pane}`;
    const escaped = command.replace(/'/g, `'\\''`);
    const { stderr } = await this.run(`tmux send-keys -t '${target}' '${escaped}' Enter`);
    if (stderr) return { ok: false, error: stderr.trim() };
    const session = this.sessions.get(name);
    if (session) session.lastActivity = Date.now();
    return { ok: true };
  }

  async captureOutput(name: string, pane = 0): Promise<string> {
    const target = `${name}:0.${pane}`;
    const { stdout } = await this.run(`tmux capture-pane -p -t '${target}'`);
    return stdout;
  }

  async getSession(name: string): Promise<{ name: string; windows: number; panes: number; output: string } | null> {
    const { stdout: windowOut } = await this.run(`tmux list-windows -t ${name} 2>/dev/null | wc -l`);
    const windows = parseInt(windowOut.trim(), 10) || 0;
    if (windows === 0) {
      this.sessions.delete(name);
      return null;
    }
    const { stdout: paneOut } = await this.run(`tmux list-panes -t ${name}:0 2>/dev/null | wc -l`);
    const panes = parseInt(paneOut.trim(), 10) || 1;
    const output = await this.captureOutput(name);
    const session = this.sessions.get(name);
    if (session) { session.windows = windows; session.lastActivity = Date.now(); }
    return { name, windows, panes, output };
  }

  async killSession(name: string): Promise<{ ok: boolean; error?: string }> {
    const { stderr } = await this.run(`tmux kill-session -t ${name}`);
    this.sessions.delete(name);
    if (stderr) return { ok: false, error: stderr.trim() };
    this.logger.log(`Killed tmux session: ${name}`);
    return { ok: true };
  }

  async listSessions(): Promise<TmuxSession[]> {
    const { stdout } = await this.run(`tmux list-sessions -F '#{session_name}' 2>/dev/null`);
    const names = stdout.split('\n').map((s) => s.trim()).filter(Boolean);
    const result: TmuxSession[] = [];
    for (const name of names) {
      const existing = this.sessions.get(name) ?? { name, windows: 1, created: Date.now(), lastActivity: Date.now() };
      this.sessions.set(name, existing);
      result.push(existing);
    }
    // Remove stale local entries no longer in tmux
    for (const key of this.sessions.keys()) {
      if (!names.includes(key)) this.sessions.delete(key);
    }
    return result;
  }

  async splitPane(name: string, direction: 'h' | 'v'): Promise<{ ok: boolean; error?: string }> {
    const flag = direction === 'h' ? '-h' : '-v';
    const { stderr } = await this.run(`tmux split-window ${flag} -t ${name}:0`);
    if (stderr) return { ok: false, error: stderr.trim() };
    return { ok: true };
  }

  async newWindow(name: string, windowName?: string): Promise<{ ok: boolean; error?: string }> {
    const nameFlag = windowName ? `-n '${windowName}'` : '';
    const { stderr } = await this.run(`tmux new-window ${nameFlag} -t ${name}`);
    if (stderr) return { ok: false, error: stderr.trim() };
    return { ok: true };
  }

  private async cleanupStaleSessions() {
    const now = Date.now();
    for (const [name, session] of this.sessions) {
      if (now - session.lastActivity > STALE_SESSION_MS) {
        this.logger.log(`Auto-cleaning stale session: ${name}`);
        await this.killSession(name);
      }
    }
  }
}
