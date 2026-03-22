import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { spawn, IPty } from 'node-pty';
import { v4 as uuidv4 } from 'uuid';

interface PtySession {
  id: string;
  pty: IPty;
  socketId: string;
  userId: string;
  createdAt: Date;
  lastInputAt: Date;
}

type SendFn = (socketId: string, data: string) => void;

const MAX_SESSIONS_PER_USER = 5;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 min

@Injectable()
export class PtySessionManager implements OnModuleDestroy {
  private readonly logger = new Logger(PtySessionManager.name);
  private readonly sessions = new Map<string, PtySession>();
  private sendFn: SendFn | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    for (const session of this.sessions.values()) {
      session.pty.kill();
    }
    this.sessions.clear();
  }

  setSendFunction(fn: SendFn): void {
    this.sendFn = fn;
    this.cleanupTimer = setInterval(() => this.cleanupIdle(), CLEANUP_INTERVAL_MS);
    this.logger.log('PTY session manager initialized');
  }

  createSession(socketId: string, userId: string, cols: number, rows: number, cwd?: string): string | null {
    // Check per-user limit
    const userCount = [...this.sessions.values()].filter(s => s.userId === userId).length;
    if (userCount >= MAX_SESSIONS_PER_USER) {
      this.logger.warn(`User ${userId} exceeded max PTY sessions (${MAX_SESSIONS_PER_USER})`);
      return null;
    }

    const sessionId = uuidv4();
    const shell = '/bin/sh';

    try {
      const pty = spawn(shell, [], {
        name: 'xterm-256color',
        cols: Math.min(cols || 80, 300),
        rows: Math.min(rows || 24, 100),
        cwd: cwd || '/workspace',
        env: { ...process.env, TERM: 'xterm-256color', HOME: '/tmp' },
      });

      const session: PtySession = {
        id: sessionId,
        pty,
        socketId,
        userId,
        createdAt: new Date(),
        lastInputAt: new Date(),
      };

      pty.onData((data: string) => {
        if (this.sendFn) {
          this.sendFn(socketId, JSON.stringify({
            type: 'pty:output',
            payload: { sessionId, data },
          }));
        }
      });

      pty.onExit(({ exitCode }) => {
        this.logger.log(`PTY session ${sessionId} exited with code ${exitCode}`);
        if (this.sendFn) {
          this.sendFn(socketId, JSON.stringify({
            type: 'pty:exit',
            payload: { sessionId, exitCode },
          }));
        }
        this.sessions.delete(sessionId);
      });

      this.sessions.set(sessionId, session);
      this.logger.log(`PTY session created: ${sessionId} for user ${userId}`);
      return sessionId;
    } catch (err) {
      this.logger.error(`Failed to create PTY session: ${(err as Error).message}`);
      return null;
    }
  }

  writeInput(sessionId: string, socketId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.socketId !== socketId) return false;
    session.lastInputAt = new Date();
    session.pty.write(data);
    return true;
  }

  resize(sessionId: string, socketId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.socketId !== socketId) return false;
    session.pty.resize(Math.min(cols, 300), Math.min(rows, 100));
    return true;
  }

  destroySession(sessionId: string, socketId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.socketId !== socketId) return false;
    session.pty.kill();
    this.sessions.delete(sessionId);
    this.logger.log(`PTY session destroyed: ${sessionId}`);
    return true;
  }

  destroyAllForSocket(socketId: string): void {
    for (const [id, session] of this.sessions.entries()) {
      if (session.socketId === socketId) {
        session.pty.kill();
        this.sessions.delete(id);
      }
    }
  }

  private cleanupIdle(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastInputAt.getTime() > IDLE_TIMEOUT_MS) {
        this.logger.log(`Cleaning up idle PTY session: ${id}`);
        session.pty.kill();
        this.sessions.delete(id);
      }
    }
  }
}
