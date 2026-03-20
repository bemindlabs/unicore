// Adapter Registry — @unicore/integrations
// Central registry for discovering and instantiating adapters by id.

import type { IAdapter, AdapterMeta } from './types/adapter.js';
import { StripeAdapter } from './adapters/stripe/index.js';
import { PlaidAdapter } from './adapters/plaid/index.js';
import { EmailAdapter } from './adapters/email/index.js';
import { TiktokAdapter } from './adapters/tiktok/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdapter = IAdapter<any, any>;
type AdapterFactory = () => AnyAdapter;

/**
 * Global adapter registry.
 *
 * Usage:
 *   const adapter = AdapterRegistry.create('stripe');
 *   await adapter.connect(config);
 */
export class AdapterRegistry {
  static readonly #factories = new Map<string, AdapterFactory>([
    ['stripe', () => new StripeAdapter()],
    ['plaid', () => new PlaidAdapter()],
    ['email', () => new EmailAdapter()],
    ['tiktok', () => new TiktokAdapter()],
  ]);

  /**
   * List metadata for all registered adapters.
   */
  static list(): AdapterMeta[] {
    return [...this.#factories.keys()].map((id) => {
      const adapter = this.#factories.get(id)!();
      return adapter.meta;
    });
  }

  /**
   * Check if an adapter id is registered.
   */
  static has(id: string): boolean {
    return this.#factories.has(id);
  }

  /**
   * Create a fresh adapter instance by id.
   * Throws if the id is not registered.
   */
  static create(id: string): AnyAdapter {
    const factory = this.#factories.get(id);
    if (!factory) {
      throw new Error(
        `No adapter registered for id "${id}". Available: ${[...this.#factories.keys()].join(', ')}`,
      );
    }
    return factory();
  }

  /**
   * Register a custom adapter factory.
   */
  static register(id: string, factory: AdapterFactory): void {
    this.#factories.set(id, factory);
  }
}
