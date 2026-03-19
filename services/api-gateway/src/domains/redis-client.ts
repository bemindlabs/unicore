/**
 * Minimal Redis RESP2 client using Node's built-in net module.
 *
 * Supports only the subset of commands used by DomainCacheService:
 *   GET, SET (with EX option), DEL, KEYS, PING.
 *
 * This avoids adding an external redis/ioredis dependency while keeping
 * the implementation self-contained. Replace with ioredis / redis@4 when
 * a package manager pass is run.
 */

import * as net from 'net';

export interface SetOptions {
  /** Expire in seconds */
  EX?: number;
}

export class RedisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisError';
  }
}

export class MinimalRedisClient {
  private socket: net.Socket | null = null;
  private connected = false;
  private readonly host: string;
  private readonly port: number;
  private readonly connectTimeoutMs: number;

  constructor(url: string = 'redis://localhost:6379', connectTimeoutMs = 5_000) {
    const parsed = new URL(url);
    this.host = parsed.hostname || 'localhost';
    this.port = parseInt(parsed.port || '6379', 10);
    this.connectTimeoutMs = connectTimeoutMs;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(this.connectTimeoutMs);

      socket.on('timeout', () => {
        socket.destroy();
        reject(new RedisError(`Connection to Redis timed out (${this.host}:${this.port})`));
      });

      socket.on('error', (err) => {
        reject(new RedisError(`Redis connection error: ${err.message}`));
      });

      socket.connect(this.port, this.host, () => {
        this.socket = socket;
        this.connected = true;
        socket.setTimeout(0); // Reset timeout after connect
        resolve();
      });
    });
  }

  async quit(): Promise<void> {
    if (!this.socket) return;
    try {
      await this.sendCommand(['QUIT']);
    } catch {
      // ignore
    }
    this.socket.destroy();
    this.socket = null;
    this.connected = false;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async ping(): Promise<string> {
    const result = await this.sendCommand(['PING']);
    return result as string;
  }

  async get(key: string): Promise<string | null> {
    const result = await this.sendCommand(['GET', key]);
    return result as string | null;
  }

  async set(key: string, value: string, options?: SetOptions): Promise<string> {
    const args = ['SET', key, value];
    if (options?.EX !== undefined) {
      args.push('EX', String(options.EX));
    }
    const result = await this.sendCommand(args);
    return result as string;
  }

  async del(key: string): Promise<number> {
    const result = await this.sendCommand(['DEL', key]);
    return result as number;
  }

  async exists(key: string): Promise<number> {
    const result = await this.sendCommand(['EXISTS', key]);
    return result as number;
  }

  async keys(pattern: string): Promise<string[]> {
    const result = await this.sendCommand(['KEYS', pattern]);
    return result as string[];
  }

  /**
   * Async generator that yields keys matching the given pattern via KEYS.
   * (For production use, SCAN should be used — left as future enhancement.)
   */
  async *scanIterator(options: { MATCH: string; COUNT?: number }): AsyncGenerator<string> {
    const matched = await this.keys(options.MATCH);
    for (const key of matched) {
      yield key;
    }
  }

  // ---------------------------------------------------------------------------
  // RESP2 protocol implementation
  // ---------------------------------------------------------------------------

  private sendCommand(args: string[]): Promise<unknown> {
    if (!this.socket || !this.connected) {
      return Promise.reject(new RedisError('Not connected'));
    }

    const command = this.encodeCommand(args);

    return new Promise((resolve, reject) => {
      let buffer = '';

      const onData = (data: Buffer) => {
        buffer += data.toString();

        let parsed: unknown;
        try {
          parsed = this.parseResp(buffer);
        } catch {
          // Incomplete — wait for more data
          return;
        }

        cleanup();

        if (parsed instanceof RedisError) {
          reject(parsed);
        } else {
          resolve(parsed);
        }
      };

      const onError = (err: Error) => {
        cleanup();
        reject(new RedisError(`Socket error: ${err.message}`));
      };

      const cleanup = () => {
        this.socket?.removeListener('data', onData);
        this.socket?.removeListener('error', onError);
      };

      this.socket!.on('data', onData);
      this.socket!.on('error', onError);
      this.socket!.write(command);
    });
  }

  private encodeCommand(args: string[]): string {
    let cmd = `*${args.length}\r\n`;
    for (const arg of args) {
      cmd += `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`;
    }
    return cmd;
  }

  /**
   * Parse a RESP2 response. Throws if the response is incomplete.
   */
  private parseResp(data: string): unknown {
    if (data.length === 0) throw new Error('incomplete');

    const type = data[0];
    const crlfIdx = data.indexOf('\r\n');

    if (crlfIdx === -1) throw new Error('incomplete');

    const line = data.slice(1, crlfIdx);

    switch (type) {
      case '+': // Simple string
        return line;

      case '-': // Error
        return new RedisError(line);

      case ':': // Integer
        return parseInt(line, 10);

      case '$': { // Bulk string
        const len = parseInt(line, 10);
        if (len === -1) return null;
        const start = crlfIdx + 2;
        if (data.length < start + len + 2) throw new Error('incomplete');
        return data.slice(start, start + len);
      }

      case '*': { // Array
        const count = parseInt(line, 10);
        if (count === -1) return null;
        const result: unknown[] = [];
        let remaining = data.slice(crlfIdx + 2);
        for (let i = 0; i < count; i++) {
          const element = this.parseResp(remaining);
          result.push(element);
          // Advance past consumed bytes (simplified — works for string elements)
          const elemStr = this.serializeRespElement(element, remaining);
          remaining = remaining.slice(elemStr);
        }
        return result;
      }

      default:
        throw new RedisError(`Unknown RESP type: ${type}`);
    }
  }

  private serializeRespElement(value: unknown, data: string): number {
    if (value === null) return '$-1\r\n'.length;
    if (typeof value === 'number') {
      const line = `:${value}\r\n`;
      return line.length;
    }
    if (typeof value === 'string') {
      if (data.startsWith('+')) return `+${value}\r\n`.length;
      // Bulk string
      return `$${Buffer.byteLength(value)}\r\n${value}\r\n`.length;
    }
    return 0;
  }
}
