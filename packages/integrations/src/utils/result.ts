// Result helpers — @unicore/integrations

import type { AdapterError, AdapterResult } from '../types/adapter.js';

/**
 * Construct a successful AdapterResult.
 */
export function ok<T>(data: T): AdapterResult<T> {
  return { success: true, data };
}

/**
 * Construct a successful AdapterResult with no payload.
 */
export function okVoid(): AdapterResult<void> {
  return { success: true };
}

/**
 * Construct a failed AdapterResult from an AdapterError.
 */
export function err<T = void>(error: AdapterError): AdapterResult<T> {
  return { success: false, error };
}

/**
 * Coerce an unknown thrown value into an AdapterError.
 */
export function toAdapterError(
  thrown: unknown,
  fallbackCode = 'UNKNOWN_ERROR',
  retryable = false,
): AdapterError {
  if (thrown instanceof Error) {
    return {
      code: (thrown as NodeJS.ErrnoException).code ?? fallbackCode,
      message: thrown.message,
      retryable,
    };
  }
  return {
    code: fallbackCode,
    message: String(thrown),
    retryable,
  };
}

/**
 * Wrap an async operation; any thrown error is caught and returned as err().
 */
export async function tryCatch<T>(
  fn: () => Promise<AdapterResult<T>>,
  fallbackCode?: string,
): Promise<AdapterResult<T>> {
  try {
    return await fn();
  } catch (thrown) {
    return err<T>(toAdapterError(thrown, fallbackCode));
  }
}
