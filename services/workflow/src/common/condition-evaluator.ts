/**
 * Condition evaluator — tests TriggerCondition predicates against
 * an event payload.
 */
import type { TriggerCondition } from '../schema/workflow-definition.schema';

/** Resolve a dot-notation path against a plain object. */
function resolvePath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Evaluates a single condition against the provided payload.
 * Returns true if the condition is satisfied.
 */
export function evaluateCondition(
  condition: TriggerCondition,
  payload: unknown,
): boolean {
  const actual = resolvePath(payload, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'gt':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'gte':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case 'lt':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'lte':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    case 'contains':
      return (
        typeof actual === 'string' &&
        typeof expected === 'string' &&
        actual.includes(expected)
      );
    case 'not_contains':
      return (
        typeof actual === 'string' &&
        typeof expected === 'string' &&
        !actual.includes(expected)
      );
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'not_exists':
      return actual === undefined || actual === null;
    default:
      return false;
  }
}

/**
 * Returns true only when ALL conditions pass.
 * An empty conditions array always evaluates to true.
 */
export function evaluateConditions(
  conditions: TriggerCondition[] | undefined,
  payload: unknown,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(c, payload));
}
