// Stripe-specific types — @bemindlabs/unicore-integrations

export interface StripeConfig {
  /** Stripe secret key (sk_live_… or sk_test_…). */
  secretKey: string;
  /** Optional webhook signing secret for event verification. */
  webhookSecret?: string;
  /** API version to pin (defaults to latest). */
  apiVersion?: string;
}

export type StripePaymentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'canceled'
  | 'succeeded';

export interface StripePaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: StripePaymentStatus;
  customerId?: string;
  description?: string;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface StripeCustomer {
  id: string;
  email?: string;
  name?: string;
  metadata: Record<string, string>;
  createdAt: string;
}

export interface StripeCharge {
  id: string;
  paymentIntentId: string;
  amount: number;
  amountRefunded: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed';
  failureCode?: string;
  failureMessage?: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export type StripeSyncData = StripePaymentIntent | StripeCharge | StripeCustomer;
