// Config validation helpers — @bemindlabs/unicore-integrations

import type { AdapterError } from '../types/adapter.js';

/**
 * Assert that all required string fields are present and non-empty.
 * Returns an AdapterError if any are missing, otherwise undefined.
 */
export function validateRequiredFields(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>,
  fields: string[],
): AdapterError | undefined {
  const missing = fields.filter(
    (f) => !config[f] || (typeof config[f] === 'string' && (config[f] as string).trim() === ''),
  );

  if (missing.length > 0) {
    return {
      code: 'INVALID_CONFIG',
      message: `Missing required configuration fields: ${missing.join(', ')}`,
      retryable: false,
      details: { missingFields: missing },
    };
  }

  return undefined;
}

/**
 * Validate that a URL string is well-formed.
 */
export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate an email address format (basic RFC-5322 subset).
 */
export function isValidEmail(value: string): boolean {
  if (value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
