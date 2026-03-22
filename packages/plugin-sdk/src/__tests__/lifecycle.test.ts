import { PluginLifecycleManager, PluginLifecycleError } from '../lifecycle-manager';
import { definePlugin } from '../index';
import type { Plugin, PluginManifest } from '../types';

const baseManifest: PluginManifest = {
  id: 'lifecycle-test',
  name: 'Lifecycle Test',
  version: '1.0.0',
  type: 'integration',
  entrypoint: 'dist/index.js',
};

function makePlugin(id = 'lifecycle-test', overrides: Partial<Plugin> = {}): Plugin {
  return definePlugin({ ...baseManifest, id }, async () => {}, {
    deactivate: async () => {},
    configure: async () => {},
    ...overrides,
  });
}

describe('PluginLifecycleManager', () => {
  let manager: PluginLifecycleManager;

  beforeEach(() => {
    manager = new PluginLifecycleManager();
  });

  describe('register / unregister', () => {
    it('registers a plugin successfully', () => {
      const plugin = makePlugin();
      manager.register(plugin);
      expect(manager.isRegistered('lifecycle-test')).toBe(true);
    });

    it('throws when registering the same plugin twice', () => {
      manager.register(makePlugin());
      expect(() => manager.register(makePlugin())).toThrow(PluginLifecycleError);
    });

    it('initial status is inactive', () => {
      manager.register(makePlugin());
      expect(manager.getStatus('lifecycle-test')).toBe('inactive');
    });

    it('unregisters an inactive plugin', () => {
      manager.register(makePlugin());
      manager.unregister('lifecycle-test');
      expect(manager.isRegistered('lifecycle-test')).toBe(false);
    });

    it('cannot unregister an active plugin', async () => {
      manager.register(makePlugin());
      await manager.activate('lifecycle-test');
      expect(() => manager.unregister('lifecycle-test')).toThrow(PluginLifecycleError);
    });

    it('throws when getting status of unknown plugin', () => {
      expect(() => manager.getStatus('unknown')).toThrow(PluginLifecycleError);
    });
  });

  describe('activate', () => {
    it('activates a plugin and sets status to active', async () => {
      manager.register(makePlugin());
      await manager.activate('lifecycle-test');
      expect(manager.getStatus('lifecycle-test')).toBe('active');
    });

    it('passes config to the plugin context', async () => {
      let receivedConfig: Record<string, unknown> = {};
      const plugin = definePlugin(baseManifest, async (ctx) => {
        receivedConfig = ctx.config;
      });
      manager.register(plugin);
      await manager.activate('lifecycle-test', { apiKey: 'abc' });
      expect(receivedConfig.apiKey).toBe('abc');
    });

    it('throws when activating an already-active plugin', async () => {
      manager.register(makePlugin());
      await manager.activate('lifecycle-test');
      await expect(manager.activate('lifecycle-test')).rejects.toThrow(PluginLifecycleError);
    });

    it('sets status to error if activation throws', async () => {
      const plugin = definePlugin(baseManifest, async () => {
        throw new Error('Activation failed');
      });
      manager.register(plugin);
      await expect(manager.activate('lifecycle-test')).rejects.toThrow(PluginLifecycleError);
      expect(manager.getStatus('lifecycle-test')).toBe('error');
    });

    it('validates config against manifest configSchema', async () => {
      const plugin = definePlugin(
        {
          ...baseManifest,
          configSchema: {
            type: 'object',
            required: ['apiKey'],
            properties: { apiKey: { type: 'string' } },
          },
        },
        async () => {},
      );
      manager.register(plugin);
      await expect(manager.activate('lifecycle-test', {})).rejects.toThrow(PluginLifecycleError);
    });

    it('sets activatedAt timestamp', async () => {
      manager.register(makePlugin());
      await manager.activate('lifecycle-test');
      const reg = manager.getRegistration('lifecycle-test');
      expect(reg.activatedAt).toBeInstanceOf(Date);
    });
  });

  describe('deactivate', () => {
    it('deactivates an active plugin', async () => {
      manager.register(makePlugin());
      await manager.activate('lifecycle-test');
      await manager.deactivate('lifecycle-test');
      expect(manager.getStatus('lifecycle-test')).toBe('inactive');
    });

    it('throws when deactivating an inactive plugin', async () => {
      manager.register(makePlugin());
      await expect(manager.deactivate('lifecycle-test')).rejects.toThrow(PluginLifecycleError);
    });

    it('sets status to error if deactivation throws', async () => {
      const plugin = definePlugin(baseManifest, async () => {}, {
        deactivate: async () => {
          throw new Error('Cleanup failed');
        },
      });
      manager.register(plugin);
      await manager.activate('lifecycle-test');
      await expect(manager.deactivate('lifecycle-test')).rejects.toThrow(PluginLifecycleError);
      expect(manager.getStatus('lifecycle-test')).toBe('error');
    });

    it('sets deactivatedAt timestamp', async () => {
      manager.register(makePlugin());
      await manager.activate('lifecycle-test');
      await manager.deactivate('lifecycle-test');
      expect(manager.getRegistration('lifecycle-test').deactivatedAt).toBeInstanceOf(Date);
    });
  });

  describe('configure', () => {
    it('updates plugin config', async () => {
      manager.register(makePlugin());
      await manager.configure('lifecycle-test', { theme: 'dark' });
      const reg = manager.getRegistration('lifecycle-test');
      expect(reg.config.theme).toBe('dark');
    });

    it('merges config with existing config', async () => {
      manager.register(makePlugin());
      await manager.configure('lifecycle-test', { a: 1 });
      await manager.configure('lifecycle-test', { b: 2 });
      const { config } = manager.getRegistration('lifecycle-test');
      expect(config.a).toBe(1);
      expect(config.b).toBe(2);
    });

    it('calls plugin.configure with new config', async () => {
      const configured: unknown[] = [];
      const plugin = definePlugin(baseManifest, async () => {}, {
        configure: async (cfg) => { configured.push(cfg); },
      });
      manager.register(plugin);
      await manager.configure('lifecycle-test', { x: 42 });
      expect(configured).toHaveLength(1);
      expect((configured[0] as Record<string, unknown>).x).toBe(42);
    });

    it('validates config against schema on configure', async () => {
      const plugin = definePlugin(
        {
          ...baseManifest,
          configSchema: {
            type: 'object',
            properties: { count: { type: 'number', minimum: 0 } },
          },
        },
        async () => {},
      );
      manager.register(plugin);
      await expect(manager.configure('lifecycle-test', { count: -5 })).rejects.toThrow(
        PluginLifecycleError,
      );
    });
  });

  describe('disable / enable', () => {
    it('disables and re-enables a plugin', () => {
      manager.register(makePlugin());
      manager.disable('lifecycle-test');
      expect(manager.getStatus('lifecycle-test')).toBe('disabled');
      manager.enable('lifecycle-test');
      expect(manager.getStatus('lifecycle-test')).toBe('inactive');
    });

    it('cannot activate a disabled plugin', async () => {
      manager.register(makePlugin());
      manager.disable('lifecycle-test');
      await expect(manager.activate('lifecycle-test')).rejects.toThrow(PluginLifecycleError);
    });
  });

  describe('getActive / getAll / deactivateAll', () => {
    it('returns only active registrations', async () => {
      manager.register(makePlugin('p1'));
      manager.register(makePlugin('p2'));
      await manager.activate('p1');
      expect(manager.getActive()).toHaveLength(1);
      expect(manager.getActive()[0].plugin.manifest.id).toBe('p1');
    });

    it('deactivateAll stops all active plugins', async () => {
      manager.register(makePlugin('p1'));
      manager.register(makePlugin('p2'));
      await manager.activate('p1');
      await manager.activate('p2');
      await manager.deactivateAll();
      expect(manager.getActive()).toHaveLength(0);
    });
  });
});
