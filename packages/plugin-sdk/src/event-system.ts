import type { PluginEvent, PluginEventHandler, PluginEventType } from './types.js';

export class PluginEventEmitter {
  private handlers = new Map<PluginEventType | '*', Set<PluginEventHandler>>();

  on(event: PluginEventType | '*', handler: PluginEventHandler): this {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return this;
  }

  off(event: PluginEventType | '*', handler: PluginEventHandler): this {
    this.handlers.get(event)?.delete(handler);
    return this;
  }

  once(event: PluginEventType | '*', handler: PluginEventHandler): this {
    const wrapper: PluginEventHandler = async (evt) => {
      this.off(event, wrapper);
      await handler(evt);
    };
    return this.on(event, wrapper);
  }

  async emit(
    type: PluginEventType,
    pluginId: string,
    data?: unknown,
  ): Promise<void> {
    const event: PluginEvent = { type, pluginId, timestamp: new Date(), data };

    const specific = this.handlers.get(type);
    const wildcard = this.handlers.get('*');

    const all: PluginEventHandler[] = [
      ...(specific ? [...specific] : []),
      ...(wildcard ? [...wildcard] : []),
    ];

    await Promise.allSettled(all.map((h) => h(event)));
  }

  removeAllListeners(event?: PluginEventType | '*'): this {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
    return this;
  }

  listenerCount(event: PluginEventType | '*'): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}
