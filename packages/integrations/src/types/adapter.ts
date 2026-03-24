// Core Adapter Interface — @bemindlabs/unicore-integrations

/**
 * Lifecycle result wrapper for adapter operations.
 */
export interface AdapterResult<T = void> {
  success: boolean;
  data?: T;
  error?: AdapterError;
}

/**
 * Structured error from an adapter operation.
 */
export interface AdapterError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

/**
 * Connection state reported by an adapter.
 */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'rate_limited';

/**
 * Health snapshot returned by connect/getStatus.
 */
export interface AdapterHealth {
  status: ConnectionStatus;
  latencyMs?: number;
  lastCheckedAt: string;
  message?: string;
}

/**
 * Metadata that every adapter must expose.
 */
export interface AdapterMeta {
  /** Unique identifier for the adapter type (e.g. "stripe", "plaid", "smtp"). */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;
  /** Short description of what the adapter does. */
  readonly description: string;
  /** Semantic version string of this adapter implementation. */
  readonly version: string;
  /** Category used for grouping in the UI. */
  readonly category: AdapterCategory;
}

export type AdapterCategory = 'payment' | 'banking' | 'email' | 'crm' | 'storage' | 'custom';

/**
 * Sync direction supported by the adapter.
 */
export type SyncDirection = 'inbound' | 'outbound' | 'bidirectional';

/**
 * Options passed into each sync() call.
 */
export interface SyncOptions {
  /** Only fetch records modified after this ISO-8601 timestamp. */
  since?: string;
  /** Maximum number of records to retrieve in a single sync. */
  limit?: number;
  /** Sync direction override (defaults to adapter's natural direction). */
  direction?: SyncDirection;
  /** Arbitrary provider-specific options. */
  params?: Record<string, unknown>;
}

/**
 * Summary returned from a sync() call.
 */
export interface SyncResult {
  direction: SyncDirection;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors: AdapterError[];
  syncedAt: string;
  nextSyncToken?: string;
}

/**
 * Core adapter contract that ALL adapters must implement.
 *
 * T  — provider-specific configuration shape.
 * D  — domain data type exchanged during sync (informational, used by callers).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface IAdapter<T, _D = unknown> {
  /** Static metadata about this adapter. */
  readonly meta: AdapterMeta;

  /**
   * Establish a connection to the external service.
   * Should validate credentials and confirm reachability.
   */
  connect(config: T): Promise<AdapterResult<AdapterHealth>>;

  /**
   * Cleanly terminate the connection and release any held resources.
   */
  disconnect(): Promise<AdapterResult>;

  /**
   * Retrieve the current connection health without performing a full reconnect.
   */
  getStatus(): Promise<AdapterHealth>;

  /**
   * Pull data from (or push data to) the external service.
   */
  sync(options?: SyncOptions): Promise<AdapterResult<SyncResult>>;
}
