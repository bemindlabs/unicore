import type { JSONSchemaObject, ValidationResult } from './types.js';

function getType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matchesType(value: unknown, type: string): boolean {
  const actual = getType(value);
  if (type === 'integer') return actual === 'number' && Number.isInteger(value as number);
  return actual === type;
}

function validateValue(
  value: unknown,
  schema: JSONSchemaObject,
  path: string,
  errors: string[],
): void {
  // type check
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${path}: expected type ${types.join('|')}, got ${getType(value)}`);
      return;
    }
  }

  // enum
  if (schema.enum !== undefined) {
    if (!schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
      errors.push(`${path}: value must be one of [${schema.enum.map((e) => JSON.stringify(e)).join(', ')}]`);
    }
    return;
  }

  const actualType = getType(value);

  if (actualType === 'number' || actualType === 'bigint') {
    const num = Number(value);
    if (schema.minimum !== undefined && num < schema.minimum) {
      errors.push(`${path}: ${num} is less than minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && num > schema.maximum) {
      errors.push(`${path}: ${num} exceeds maximum ${schema.maximum}`);
    }
  }

  if (actualType === 'string') {
    const str = value as string;
    if (schema.minLength !== undefined && str.length < schema.minLength) {
      errors.push(`${path}: string length ${str.length} is less than minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && str.length > schema.maxLength) {
      errors.push(`${path}: string length ${str.length} exceeds maxLength ${schema.maxLength}`);
    }
    if (schema.pattern !== undefined) {
      const re = new RegExp(schema.pattern);
      if (!re.test(str)) {
        errors.push(`${path}: string does not match pattern ${schema.pattern}`);
      }
    }
  }

  if (actualType === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;

    // required fields
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in obj)) {
          errors.push(`${path}: missing required property '${key}'`);
        }
      }
    }

    // properties
    if (schema.properties) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          validateValue(obj[key], subSchema, `${path}.${key}`, errors);
        }
      }
    }

    // additionalProperties
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(obj)) {
        if (!(key in schema.properties)) {
          errors.push(`${path}: additional property '${key}' is not allowed`);
        }
      }
    }
  }

  if (actualType === 'array' && schema.items) {
    const arr = value as unknown[];
    arr.forEach((item, i) => {
      validateValue(item, schema.items!, `${path}[${i}]`, errors);
    });
  }
}

export function validateSchema(
  data: unknown,
  schema: JSONSchemaObject,
  rootPath = 'root',
): ValidationResult {
  const errors: string[] = [];
  validateValue(data, schema, rootPath, errors);
  return { valid: errors.length === 0, errors };
}

/** Validate a plugin manifest object structure */
export const MANIFEST_SCHEMA: JSONSchemaObject = {
  type: 'object',
  required: ['id', 'name', 'version', 'type', 'entrypoint'],
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      pattern: '^[a-z0-9][a-z0-9-_.]*$',
    },
    name: { type: 'string', minLength: 1 },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+',
    },
    description: { type: 'string' },
    author: { type: 'string' },
    type: {
      type: 'string',
      enum: ['agent', 'integration', 'workflow', 'theme'],
    },
    entrypoint: { type: 'string', minLength: 1 },
    permissions: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['network', 'filesystem', 'database', 'events', 'config', 'ai', 'workflow', 'crm', 'notifications'],
      },
    },
    dependencies: { type: 'object' },
    unicoreVersion: { type: 'string' },
  },
  additionalProperties: false,
};
