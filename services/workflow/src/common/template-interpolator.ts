/**
 * Template interpolator — replaces {{field.path}} tokens in strings
 * using values from a merged context object.
 *
 * Supports dot-notation paths (e.g. {{payload.amount}}).
 */

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
 * Interpolates all `{{token}}` occurrences in `template` using `context`.
 * Unknown tokens are left as-is.
 */
export function interpolate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path: string) => {
    const value = resolvePath(context, path.trim());
    return value !== undefined ? String(value) : match;
  });
}
