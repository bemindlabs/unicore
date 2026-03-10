// Plaid-specific types — @unicore/integrations

export interface PlaidConfig {
  /** Plaid client ID. */
  clientId: string;
  /** Plaid secret for the chosen environment. */
  secret: string;
  /** Plaid API environment. */
  environment: PlaidEnvironment;
  /** Access token obtained after the Link flow; required before sync. */
  accessToken?: string;
}

export type PlaidEnvironment = 'sandbox' | 'development' | 'production';

export type PlaidAccountType = 'depository' | 'credit' | 'loan' | 'investment' | 'other';

export type PlaidAccountSubtype =
  | 'checking'
  | 'savings'
  | 'money market'
  | 'cd'
  | 'credit card'
  | 'auto'
  | 'mortgage'
  | 'student'
  | 'other';

export interface PlaidAccount {
  accountId: string;
  institutionId: string;
  institutionName: string;
  name: string;
  officialName?: string;
  type: PlaidAccountType;
  subtype?: PlaidAccountSubtype;
  balanceCurrent?: number;
  balanceAvailable?: number;
  balanceLimit?: number;
  currencyCode: string;
  mask?: string;
}

export type PlaidTransactionType = 'digital' | 'place' | 'special' | 'unresolved';

export interface PlaidTransaction {
  transactionId: string;
  accountId: string;
  amount: number;
  isoCurrencyCode?: string;
  date: string;
  name: string;
  merchantName?: string;
  paymentChannel: 'online' | 'in store' | 'other';
  pending: boolean;
  category?: string[];
  categoryId?: string;
  type: PlaidTransactionType;
  transactionCode?: string;
}

export interface PlaidLinkTokenRequest {
  userId: string;
  clientName: string;
  products: PlaidProduct[];
  countryCodes: string[];
  language: string;
}

export type PlaidProduct = 'transactions' | 'auth' | 'identity' | 'investments' | 'liabilities';

export interface PlaidLinkToken {
  linkToken: string;
  expiration: string;
  requestId: string;
}

export type PlaidSyncData = PlaidTransaction | PlaidAccount;
