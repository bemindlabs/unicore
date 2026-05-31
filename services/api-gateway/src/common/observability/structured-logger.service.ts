import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';
import { getRequestContext } from './request-context';
import { getTenantId } from '../tenancy/tenant-store';

/**
 * Structured JSON logger (GAPS #15 — lean observability baseline).
 *
 * In production (`NODE_ENV=production`) every line is a single JSON object with
 * the request-correlation trio (`requestId` + `tenantId` + `userId`) pulled from
 * the request-scoped ALS, so logs are greppable/aggregatable by any log shipper
 * without a heavyweight transport dependency. In dev it falls back to Nest's
 * pretty `ConsoleLogger` so local output stays readable.
 *
 * Deliberately built on Nest's own `LoggerService` contract (no `pino` /
 * `nestjs-pino` dependency) to keep the wiring lean — it is installed via
 * `app.useLogger(...)` so EVERY existing `new Logger(...)` call site is upgraded
 * with zero code churn.
 */
@Injectable()
export class StructuredLogger extends ConsoleLogger {
  private readonly json = process.env.NODE_ENV === 'production';

  log(message: unknown, context?: string): void {
    this.emit('log', message, context);
  }
  error(message: unknown, stackOrContext?: string, context?: string): void {
    this.emit('error', message, context ?? stackOrContext, stackOrContext);
  }
  warn(message: unknown, context?: string): void {
    this.emit('warn', message, context);
  }
  debug(message: unknown, context?: string): void {
    this.emit('debug', message, context);
  }
  verbose(message: unknown, context?: string): void {
    this.emit('verbose', message, context);
  }

  private emit(
    level: LogLevel,
    message: unknown,
    context?: string,
    stack?: string,
  ): void {
    if (!this.json) {
      // Dev: keep Nest's readable colored output.
      switch (level) {
        case 'error':
          return super.error(message as string, stack as string, context);
        case 'warn':
          return super.warn(message as string, context);
        case 'debug':
          return super.debug(message as string, context);
        case 'verbose':
          return super.verbose(message as string, context);
        default:
          return super.log(message as string, context);
      }
    }

    const reqCtx = getRequestContext();
    const entry: Record<string, unknown> = {
      level,
      time: new Date().toISOString(),
      message:
        typeof message === 'string' ? message : safeStringify(message),
      context,
    };
    if (reqCtx) {
      entry.requestId = reqCtx.requestId;
      entry.userId = reqCtx.userId;
      entry.tenantId = getTenantId();
    }
    if (level === 'error' && stack && stack !== context) {
      entry.stack = stack;
    }
    // Single-line JSON to stdout/stderr for the log shipper.
    const line = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
