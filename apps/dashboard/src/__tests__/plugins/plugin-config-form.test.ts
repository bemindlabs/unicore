// Updated: 2026-03-23
import {
  validateField,
  validateAll,
  defaultForSchema,
  buildDefaults,
} from '../../components/plugins/plugin-config-form';
import type { JsonSchema, JsonSchemaProperty } from '../../components/plugins/plugin-config-form';

// ---------------------------------------------------------------------------
// validateField
// ---------------------------------------------------------------------------

describe('validateField', () => {
  describe('string type', () => {
    const schema: JsonSchemaProperty = { type: 'string', title: 'Name', minLength: 3, maxLength: 10 };

    it('returns null for a valid string', () => {
      expect(validateField('name', schema, 'hello')).toBeNull();
    });

    it('returns error when value is shorter than minLength', () => {
      expect(validateField('name', schema, 'hi')).toMatch(/at least 3/);
    });

    it('returns error when value exceeds maxLength', () => {
      expect(validateField('name', schema, 'toolongvalue')).toMatch(/at most 10/);
    });

    it('returns minLength error for empty string when minLength > 0', () => {
      expect(validateField('name', schema, '')).toMatch(/at least 3/);
    });
  });

  describe('pattern validation', () => {
    const schema: JsonSchemaProperty = { type: 'string', title: 'Email', pattern: '^[^@]+@[^@]+$' };

    it('returns null when pattern matches', () => {
      expect(validateField('email', schema, 'user@example.com')).toBeNull();
    });

    it('returns error when pattern does not match', () => {
      expect(validateField('email', schema, 'notanemail')).toMatch(/invalid format/);
    });

    it('returns null for empty string (not validated by pattern)', () => {
      expect(validateField('email', schema, '')).toBeNull();
    });
  });

  describe('number type', () => {
    const schema: JsonSchemaProperty = { type: 'number', title: 'Score', minimum: 0, maximum: 100 };

    it('returns null for a valid number', () => {
      expect(validateField('score', schema, 42)).toBeNull();
    });

    it('returns error below minimum', () => {
      expect(validateField('score', schema, -1)).toMatch(/≥ 0/);
    });

    it('returns error above maximum', () => {
      expect(validateField('score', schema, 101)).toMatch(/≤ 100/);
    });

    it('returns error for non-numeric value', () => {
      expect(validateField('score', schema, 'abc')).toMatch(/valid number/);
    });

    it('returns null at boundary values', () => {
      expect(validateField('score', schema, 0)).toBeNull();
      expect(validateField('score', schema, 100)).toBeNull();
    });
  });

  describe('integer type', () => {
    const schema: JsonSchemaProperty = { type: 'integer', title: 'Count', minimum: 1, maximum: 10 };

    it('returns null for a valid integer', () => {
      expect(validateField('count', schema, 5)).toBeNull();
    });

    it('returns error when out of range', () => {
      expect(validateField('count', schema, 0)).toMatch(/≥ 1/);
      expect(validateField('count', schema, 11)).toMatch(/≤ 10/);
    });
  });
});

// ---------------------------------------------------------------------------
// validateAll
// ---------------------------------------------------------------------------

describe('validateAll', () => {
  const schema: JsonSchema = {
    properties: {
      apiKey: { type: 'string', title: 'API Key', minLength: 10 },
      maxTokens: { type: 'integer', title: 'Max Tokens', minimum: 1, maximum: 4096 },
      enabled: { type: 'boolean', title: 'Enabled' },
    },
    required: ['apiKey'],
  };

  it('returns empty errors for valid values', () => {
    const errors = validateAll(schema, { apiKey: 'sk-1234567890', maxTokens: 512, enabled: true });
    expect(errors).toEqual({});
  });

  it('returns error for missing required field', () => {
    const errors = validateAll(schema, { maxTokens: 512 });
    expect(errors).toHaveProperty('apiKey');
    expect(errors.apiKey).toMatch(/required/i);
  });

  it('returns error for empty string on required field', () => {
    const errors = validateAll(schema, { apiKey: '' });
    expect(errors).toHaveProperty('apiKey');
  });

  it('returns error for empty array on required array field', () => {
    const arraySchema: JsonSchema = {
      properties: { tags: { type: 'array', title: 'Tags', items: { type: 'string' } } },
      required: ['tags'],
    };
    const errors = validateAll(arraySchema, { tags: [] });
    expect(errors).toHaveProperty('tags');
  });

  it('validates non-required fields when values are provided', () => {
    const errors = validateAll(schema, { apiKey: 'sk-1234567890', maxTokens: 9999 });
    expect(errors).toHaveProperty('maxTokens');
    expect(errors.maxTokens).toMatch(/≤ 4096/);
  });

  it('skips validation for optional undefined values', () => {
    const errors = validateAll(schema, { apiKey: 'sk-1234567890' });
    expect(errors).toEqual({});
  });

  it('reports multiple errors simultaneously', () => {
    const errors = validateAll(schema, { apiKey: 'short', maxTokens: 9999 });
    expect(Object.keys(errors)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// defaultForSchema
// ---------------------------------------------------------------------------

describe('defaultForSchema', () => {
  it('returns explicit default when provided', () => {
    expect(defaultForSchema({ type: 'string', default: 'hello' })).toBe('hello');
    expect(defaultForSchema({ type: 'boolean', default: true })).toBe(true);
    expect(defaultForSchema({ type: 'integer', default: 42 })).toBe(42);
  });

  it('returns false for boolean without default', () => {
    expect(defaultForSchema({ type: 'boolean' })).toBe(false);
  });

  it('returns empty string for string without default', () => {
    expect(defaultForSchema({ type: 'string' })).toBe('');
    expect(defaultForSchema({})).toBe('');
  });

  it('returns empty string for number/integer without default', () => {
    expect(defaultForSchema({ type: 'number' })).toBe('');
    expect(defaultForSchema({ type: 'integer' })).toBe('');
  });

  it('returns empty array for array without default', () => {
    expect(defaultForSchema({ type: 'array', items: { type: 'string' } })).toEqual([]);
  });

  it('builds nested defaults for object type', () => {
    const schema: JsonSchemaProperty = {
      type: 'object',
      properties: {
        host: { type: 'string', default: 'localhost' },
        port: { type: 'integer', default: 5432 },
        ssl: { type: 'boolean' },
      },
    };
    expect(defaultForSchema(schema)).toEqual({ host: 'localhost', port: 5432, ssl: false });
  });
});

// ---------------------------------------------------------------------------
// buildDefaults
// ---------------------------------------------------------------------------

describe('buildDefaults', () => {
  it('builds a flat defaults object from schema properties', () => {
    const schema: JsonSchema = {
      properties: {
        name: { type: 'string', default: 'UniCore' },
        debug: { type: 'boolean', default: false },
        maxConnections: { type: 'integer', default: 10 },
      },
    };
    expect(buildDefaults(schema)).toEqual({ name: 'UniCore', debug: false, maxConnections: 10 });
  });

  it('returns empty object for schema with no properties', () => {
    expect(buildDefaults({})).toEqual({});
    expect(buildDefaults({ properties: {} })).toEqual({});
  });

  it('uses type-based defaults when no explicit default is set', () => {
    const schema: JsonSchema = {
      properties: {
        active: { type: 'boolean' },
        label: { type: 'string' },
        items: { type: 'array', items: { type: 'string' } },
      },
    };
    expect(buildDefaults(schema)).toEqual({ active: false, label: '', items: [] });
  });
});
