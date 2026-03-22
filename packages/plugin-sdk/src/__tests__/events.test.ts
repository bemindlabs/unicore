import { PluginEventEmitter } from '../event-system';
import type { PluginEvent } from '../types';

describe('PluginEventEmitter', () => {
  let emitter: PluginEventEmitter;

  beforeEach(() => {
    emitter = new PluginEventEmitter();
  });

  describe('on / emit', () => {
    it('calls registered handler on emit', async () => {
      const calls: PluginEvent[] = [];
      emitter.on('activate', (evt) => { calls.push(evt); });
      await emitter.emit('activate', 'plugin-1');
      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('activate');
      expect(calls[0].pluginId).toBe('plugin-1');
    });

    it('emits event with data payload', async () => {
      let received: unknown;
      emitter.on('configure', (evt) => { received = evt.data; });
      await emitter.emit('configure', 'plugin-1', { theme: 'dark' });
      expect(received).toEqual({ theme: 'dark' });
    });

    it('emits event with timestamp', async () => {
      let ts: Date | undefined;
      emitter.on('install', (evt) => { ts = evt.timestamp; });
      await emitter.emit('install', 'plugin-1');
      expect(ts).toBeInstanceOf(Date);
    });

    it('supports multiple handlers for same event', async () => {
      const results: string[] = [];
      emitter.on('activate', () => { results.push('a'); });
      emitter.on('activate', () => { results.push('b'); });
      await emitter.emit('activate', 'p');
      expect(results).toEqual(['a', 'b']);
    });

    it('does not call handlers for different event types', async () => {
      const calls: PluginEvent[] = [];
      emitter.on('deactivate', (evt) => { calls.push(evt); });
      await emitter.emit('activate', 'p');
      expect(calls).toHaveLength(0);
    });
  });

  describe('wildcard listener (*)', () => {
    it('catches all event types', async () => {
      const types: string[] = [];
      emitter.on('*', (evt) => { types.push(evt.type); });
      await emitter.emit('activate', 'p');
      await emitter.emit('deactivate', 'p');
      await emitter.emit('error', 'p');
      expect(types).toEqual(['activate', 'deactivate', 'error']);
    });

    it('receives specific + wildcard handlers', async () => {
      const calls: string[] = [];
      emitter.on('install', () => { calls.push('specific'); });
      emitter.on('*', () => { calls.push('wildcard'); });
      await emitter.emit('install', 'p');
      expect(calls).toContain('specific');
      expect(calls).toContain('wildcard');
    });
  });

  describe('off', () => {
    it('removes a specific handler', async () => {
      const calls: number[] = [];
      const handler = () => { calls.push(1); };
      emitter.on('activate', handler);
      emitter.off('activate', handler);
      await emitter.emit('activate', 'p');
      expect(calls).toHaveLength(0);
    });

    it('does not affect other handlers', async () => {
      const calls: string[] = [];
      const h1 = () => { calls.push('h1'); };
      const h2 = () => { calls.push('h2'); };
      emitter.on('activate', h1);
      emitter.on('activate', h2);
      emitter.off('activate', h1);
      await emitter.emit('activate', 'p');
      expect(calls).toEqual(['h2']);
    });
  });

  describe('once', () => {
    it('fires handler exactly once', async () => {
      const calls: number[] = [];
      emitter.once('activate', () => { calls.push(1); });
      await emitter.emit('activate', 'p');
      await emitter.emit('activate', 'p');
      expect(calls).toHaveLength(1);
    });
  });

  describe('removeAllListeners', () => {
    it('removes all handlers for a specific event', async () => {
      const calls: number[] = [];
      emitter.on('activate', () => { calls.push(1); });
      emitter.on('activate', () => { calls.push(2); });
      emitter.removeAllListeners('activate');
      await emitter.emit('activate', 'p');
      expect(calls).toHaveLength(0);
    });

    it('removes all handlers for all events', async () => {
      const calls: string[] = [];
      emitter.on('activate', () => { calls.push('activate'); });
      emitter.on('deactivate', () => { calls.push('deactivate'); });
      emitter.removeAllListeners();
      await emitter.emit('activate', 'p');
      await emitter.emit('deactivate', 'p');
      expect(calls).toHaveLength(0);
    });
  });

  describe('listenerCount', () => {
    it('returns 0 for events with no handlers', () => {
      expect(emitter.listenerCount('activate')).toBe(0);
    });

    it('counts handlers correctly', () => {
      emitter.on('activate', () => {});
      emitter.on('activate', () => {});
      expect(emitter.listenerCount('activate')).toBe(2);
    });
  });

  describe('async handlers', () => {
    it('awaits async handlers', async () => {
      const order: string[] = [];
      emitter.on('configure', async () => {
        await Promise.resolve();
        order.push('done');
      });
      await emitter.emit('configure', 'p');
      expect(order).toEqual(['done']);
    });

    it('continues even if a handler throws', async () => {
      const calls: number[] = [];
      emitter.on('error', async () => { throw new Error('handler failed'); });
      emitter.on('error', () => { calls.push(1); });
      // Should not throw
      await expect(emitter.emit('error', 'p')).resolves.toBeUndefined();
      expect(calls).toEqual([1]);
    });
  });

  describe('chaining', () => {
    it('on returns this for chaining', () => {
      const result = emitter.on('activate', () => {});
      expect(result).toBe(emitter);
    });

    it('off returns this for chaining', () => {
      const h = () => {};
      const result = emitter.on('activate', h).off('activate', h);
      expect(result).toBe(emitter);
    });
  });
});
