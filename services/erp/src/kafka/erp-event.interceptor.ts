import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { EventPublisherService } from './event-publisher.service';
import { PUBLISH_EVENT_METADATA } from './publish-event.decorator';
import type { PublishEventOptions } from './publish-event.decorator';

/**
 * ErpEventInterceptor
 *
 * NestJS interceptor that reads @PublishEvent metadata from the handler and
 * automatically publishes the handler's return value to Kafka after a
 * successful (non-throwing) response.
 *
 * Register globally in AppModule or scope it per controller:
 * ```ts
 * @UseInterceptors(ErpEventInterceptor)
 * @Controller('orders')
 * export class OrdersController { ... }
 * ```
 */
@Injectable()
export class ErpEventInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErpEventInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<PublishEventOptions | undefined>(
      PUBLISH_EVENT_METADATA,
      context.getHandler(),
    );

    if (!meta) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (result: unknown) => {
        if (result == null) return;

        const key =
          meta.keyField && typeof result === 'object' && result !== null
            ? String((result as Record<string, unknown>)[meta.keyField] ?? '')
            : undefined;

        try {
          await this.eventPublisher.publish(meta.topic, result, key || undefined);
        } catch (err) {
          // Log but do not rethrow — the HTTP response has already been sent.
          this.logger.error(
            `ErpEventInterceptor: failed to publish event for topic "${meta.topic}"`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }),
    );
  }
}
