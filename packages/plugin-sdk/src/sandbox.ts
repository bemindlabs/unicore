import type { PluginPermission, PluginSandbox } from './types.js';

export class PluginSandboxImpl implements PluginSandbox {
  readonly grantedPermissions: ReadonlySet<string>;

  constructor(permissions: (PluginPermission | string)[] = []) {
    this.grantedPermissions = new Set(permissions);
  }

  hasPermission(permission: PluginPermission | string): boolean {
    return this.grantedPermissions.has(permission);
  }

  assertPermission(permission: PluginPermission | string): void {
    if (!this.hasPermission(permission)) {
      throw new PermissionDeniedError(permission);
    }
  }
}

export class PermissionDeniedError extends Error {
  readonly permission: string;

  constructor(permission: string) {
    super(`Permission denied: '${permission}' is not granted for this plugin`);
    this.name = 'PermissionDeniedError';
    this.permission = permission;
  }
}

/** All known plugin permissions */
export const ALL_PERMISSIONS: PluginPermission[] = [
  'network',
  'filesystem',
  'database',
  'events',
  'config',
  'ai',
  'workflow',
  'crm',
  'notifications',
];
