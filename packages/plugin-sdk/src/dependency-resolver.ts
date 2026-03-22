import type { PluginManifest } from './types.js';

export class DependencyResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DependencyResolutionError';
  }
}

/**
 * Resolve plugin load order using topological sort (Kahn's algorithm).
 * Returns manifests sorted so dependencies come before dependents.
 */
export function resolveLoadOrder(manifests: PluginManifest[]): PluginManifest[] {
  const byId = new Map(manifests.map((m) => [m.id, m]));

  // Validate all declared dependencies exist
  for (const manifest of manifests) {
    for (const depId of Object.keys(manifest.dependencies ?? {})) {
      if (!byId.has(depId)) {
        throw new DependencyResolutionError(
          `Plugin '${manifest.id}' depends on '${depId}' which is not registered`,
        );
      }
    }
  }

  // Build adjacency (id → ids that depend on it)
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // depId -> [plugins that need dep]

  for (const m of manifests) {
    if (!inDegree.has(m.id)) inDegree.set(m.id, 0);
    for (const depId of Object.keys(m.dependencies ?? {})) {
      if (!dependents.has(depId)) dependents.set(depId, []);
      dependents.get(depId)!.push(m.id);
      inDegree.set(m.id, (inDegree.get(m.id) ?? 0) + 1);
    }
  }

  // Kahn's BFS
  const queue = manifests.filter((m) => (inDegree.get(m.id) ?? 0) === 0).map((m) => m.id);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const dependent of dependents.get(current) ?? []) {
      const deg = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, deg);
      if (deg === 0) queue.push(dependent);
    }
  }

  if (sorted.length !== manifests.length) {
    // Find cycle members
    const cycled = manifests.filter((m) => !sorted.includes(m.id)).map((m) => m.id);
    throw new DependencyResolutionError(
      `Circular dependency detected among plugins: ${cycled.join(', ')}`,
    );
  }

  return sorted.map((id) => byId.get(id)!);
}

/**
 * Check if a plugin version satisfies a simple constraint.
 * Supports: `*`, `>=X.Y.Z`, `^X.Y.Z` (same major), `~X.Y.Z` (same major.minor), `X.Y.Z` (exact).
 */
export function satisfiesVersion(version: string, constraint: string): boolean {
  if (constraint === '*') return true;

  const parse = (v: string): [number, number, number] => {
    const [maj = 0, min = 0, pat = 0] = v.split('.').map(Number);
    return [maj, min, pat];
  };

  const compare = (a: [number, number, number], b: [number, number, number]): number => {
    for (let i = 0; i < 3; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
  };

  const [ver] = [parse(version)];

  if (constraint.startsWith('>=')) {
    return compare(ver, parse(constraint.slice(2))) >= 0;
  }
  if (constraint.startsWith('^')) {
    const req = parse(constraint.slice(1));
    return ver[0] === req[0] && compare(ver, req) >= 0;
  }
  if (constraint.startsWith('~')) {
    const req = parse(constraint.slice(1));
    return ver[0] === req[0] && ver[1] === req[1] && compare(ver, req) >= 0;
  }
  return compare(ver, parse(constraint)) === 0;
}
