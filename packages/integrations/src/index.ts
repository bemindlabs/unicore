// @unicore/integrations — External service adapters

// Core types
export type {
  IAdapter,
  AdapterMeta,
  AdapterCategory,
  AdapterResult,
  AdapterError,
  AdapterHealth,
  ConnectionStatus,
  SyncOptions,
  SyncResult,
  SyncDirection,
} from './types/adapter.js';

// Stripe
export type {
  StripeConfig,
  StripePaymentIntent,
  StripePaymentStatus,
  StripeCustomer,
  StripeCharge,
  StripeWebhookEvent,
  StripeSyncData,
} from './types/stripe.js';

// Plaid
export type {
  PlaidConfig,
  PlaidEnvironment,
  PlaidAccount,
  PlaidAccountType,
  PlaidAccountSubtype,
  PlaidTransaction,
  PlaidTransactionType,
  PlaidProduct,
  PlaidLinkToken,
  PlaidLinkTokenRequest,
  PlaidSyncData,
} from './types/plaid.js';

// Email
export type {
  EmailConfig,
  EmailProvider,
  SmtpConfig,
  SendGridConfig,
  MailgunConfig,
  EmailAddress,
  EmailAttachment,
  EmailMessage,
  EmailSendResult,
  EmailDeliveryStatus,
} from './types/email.js';

// Adapters
export { StripeAdapter } from './adapters/stripe/index.js';
export type { IStripeClient } from './adapters/stripe/index.js';

export { PlaidAdapter } from './adapters/plaid/index.js';
export type { IPlaidClient } from './adapters/plaid/index.js';

export { EmailAdapter } from './adapters/email/index.js';
export type { IEmailTransport } from './adapters/email/index.js';

// Registry
export { AdapterRegistry } from './registry.js';

// Utils
export { ok, okVoid, err, tryCatch, toAdapterError } from './utils/result.js';
export { validateRequiredFields, isValidUrl, isValidEmail } from './utils/validation.js';
