// Tests: utility helpers

import { ok, okVoid, err, toAdapterError, tryCatch } from '../src/utils/result.js';
import { validateRequiredFields, isValidEmail, isValidUrl } from '../src/utils/validation.js';

// ─── result.ts ────────────────────────────────────────────────────────────────

describe('ok()', () => {
  it('returns a successful result with the given data', () => {
    const result = ok({ value: 42 });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ value: 42 });
    expect(result.error).toBeUndefined();
  });
});

describe('okVoid()', () => {
  it('returns a successful result with no data', () => {
    const result = okVoid();
    expect(result.success).toBe(true);
    expect(result.data).toBeUndefined();
  });
});

describe('err()', () => {
  it('returns a failed result with the given error', () => {
    const error = { code: 'E01', message: 'oops', retryable: false };
    const result = err(error);
    expect(result.success).toBe(false);
    expect(result.error).toEqual(error);
    expect(result.data).toBeUndefined();
  });
});

describe('toAdapterError()', () => {
  it('converts an Error instance', () => {
    const thrown = new Error('something went wrong');
    const ae = toAdapterError(thrown, 'FOO');
    expect(ae.code).toBe('FOO');
    expect(ae.message).toBe('something went wrong');
    expect(ae.retryable).toBe(false);
  });

  it('handles non-Error thrown values', () => {
    const ae = toAdapterError('plain string', 'BAR');
    expect(ae.code).toBe('BAR');
    expect(ae.message).toBe('plain string');
  });
});

describe('tryCatch()', () => {
  it('returns fn result on success', async () => {
    const result = await tryCatch(async () => ok(99));
    expect(result.success).toBe(true);
    expect(result.data).toBe(99);
  });

  it('catches thrown errors and returns err()', async () => {
    const result = await tryCatch(async () => {
      throw new Error('boom');
    }, 'BOOM_CODE');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('BOOM_CODE');
  });
});

// ─── validation.ts ────────────────────────────────────────────────────────────

describe('validateRequiredFields()', () => {
  it('returns undefined when all fields present', () => {
    const err = validateRequiredFields({ host: 'smtp.example.com', port: 587 }, ['host', 'port']);
    expect(err).toBeUndefined();
  });

  it('returns an AdapterError listing missing fields', () => {
    const error = validateRequiredFields({ host: '' }, ['host', 'apiKey']);
    expect(error).toBeDefined();
    expect(error!.code).toBe('INVALID_CONFIG');
    expect(error!.details?.missingFields).toContain('host');
    expect(error!.details?.missingFields).toContain('apiKey');
  });
});

describe('isValidEmail()', () => {
  it('accepts valid addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('first.last+tag@sub.domain.io')).toBe(true);
  });

  it('rejects invalid addresses', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('@nodomain')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isValidUrl()', () => {
  it('accepts valid URLs', () => {
    expect(isValidUrl('https://api.example.com/v1')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('://no-scheme')).toBe(false);
  });
});
