import { encrypt, decrypt, maskKey } from './crypto.util';

describe('crypto.util', () => {
  const originalKey = process.env.SETTINGS_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.SETTINGS_ENCRYPTION_KEY = 'test-secret-key-for-unit-tests-abc123';
  });

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env.SETTINGS_ENCRYPTION_KEY;
    } else {
      process.env.SETTINGS_ENCRYPTION_KEY = originalKey;
    }
  });

  describe('encrypt / decrypt', () => {
    it('round-trips a plaintext string', () => {
      const plaintext = 'sk-abc123';
      const encoded = encrypt(plaintext);
      expect(decrypt(encoded)).toBe(plaintext);
    });

    it('produces different ciphertexts for the same input (random IV/salt)', () => {
      const a = encrypt('same-value');
      const b = encrypt('same-value');
      expect(a).not.toBe(b);
    });

    it('returns base64 output', () => {
      const encoded = encrypt('hello');
      expect(() => Buffer.from(encoded, 'base64')).not.toThrow();
    });

    it('decrypts long API keys correctly', () => {
      const key = 'sk-proj-abcdef1234567890ABCDEF1234567890abcdef1234567890';
      expect(decrypt(encrypt(key))).toBe(key);
    });

    it('throws when SETTINGS_ENCRYPTION_KEY is missing', () => {
      const saved = process.env.SETTINGS_ENCRYPTION_KEY;
      delete process.env.SETTINGS_ENCRYPTION_KEY;
      expect(() => encrypt('test')).toThrow('SETTINGS_ENCRYPTION_KEY');
      process.env.SETTINGS_ENCRYPTION_KEY = saved;
    });

    it('throws on corrupted ciphertext', () => {
      const encoded = encrypt('valid');
      const corrupted = encoded.slice(0, -4) + 'XXXX';
      expect(() => decrypt(corrupted)).toThrow();
    });
  });

  describe('maskKey', () => {
    it('shows first 4 and last 4 chars with •••• in between', () => {
      expect(maskKey('sk-abcdefghij')).toBe('sk-a••••ghij');
    });

    it('returns ••••••••  for short keys (< 8 chars)', () => {
      expect(maskKey('short')).toBe('••••••••');
    });

    it('returns •••••••• for empty string', () => {
      expect(maskKey('')).toBe('••••••••');
    });

    it('handles exactly 8 chars', () => {
      const result = maskKey('12345678');
      expect(result).toBe('1234••••5678');
    });
  });
});
