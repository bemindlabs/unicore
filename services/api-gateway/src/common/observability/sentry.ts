import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

const logger = new Logger('Sentry');
let initialized = false;

/**
 * Initialize Sentry error tracking — GUARDED by `SENTRY_DSN` (GAPS #15).
 *
 * When `SENTRY_DSN` is unset (dev/local/test) this is a complete no-op: nothing
 * is initialized and `captureException` below silently does nothing, so the
 * exception filter and logger never crash or phone home off a developer machine.
 * In prod, set `SENTRY_DSN` (and optionally `SENTRY_ENVIRONMENT` /
 * `SENTRY_TRACES_SAMPLE_RATE`) to turn it on.
 *
 * FOLLOW-UP (not built here): webhook-delivery-failure alerting (the
 * `/webhooks/*` inbound paths) and Stripe payment/subscription event alerting
 * should also funnel into this hook (e.g. `captureException` with a
 * `webhook`/`stripe` tag, or a dedicated alert channel) so billing/integration
 * failures page on-call. Tracked as a separate observability follow-up.
 */
export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return false;
  }
  if (initialized) {
    return true;
  }
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 0,
  });
  initialized = true;
  logger.log('Sentry error tracking initialized');
  return true;
}

/** True once Sentry has been initialized (DSN was present). */
export function isSentryEnabled(): boolean {
  return initialized;
}

/**
 * Forward an unhandled exception to Sentry. No-op (and never throws) when Sentry
 * is disabled, so callers can always invoke it unconditionally.
 */
export function captureException(
  exception: unknown,
  context?: Record<string, unknown>,
): void {
  if (!initialized) {
    return;
  }
  try {
    Sentry.captureException(exception, context ? { extra: context } : undefined);
  } catch {
    // Never let error reporting break the request path.
  }
}
