'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  Receipt,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  toast,
} from '@unicore/ui';
import { api } from '@/lib/api';
import { formatCurrency as formatCurrencyBase } from '@/lib/format-currency';
import { useLicense } from '@/hooks/use-license';
import { useDemoMode } from '@/hooks/use-demo-mode';
import { useBusinessTimezone } from '@/hooks/use-business-timezone';

interface BillingInfo {
  plan: string;
  interval: string;
  amount: number;
  currency: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  paymentMethod?: {
    type: string;
    last4?: string;
    brand?: string;
    walletAddress?: string;
  };
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  pdfUrl?: string;
}

function formatCurrency(amount: number, currency: string): string {
  return formatCurrencyBase(amount / 100, currency.toUpperCase());
}

function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  }).format(new Date(iso));
}

export default function BillingSettingsPage() {
  const { isPro, edition } = useLicense();
  const isDemo = useDemoMode() as boolean;
  const tz = useBusinessTimezone();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    async function fetchBilling() {
      try {
        const [billingData, invoiceData] = await Promise.allSettled([
          api.get<BillingInfo>('/api/v1/license/billing'),
          api.get<{ invoices: Invoice[] }>('/api/v1/license/invoices'),
        ]);
        if (billingData.status === 'fulfilled') setBilling(billingData.value);
        if (invoiceData.status === 'fulfilled') setInvoices(invoiceData.value.invoices ?? []);
      } catch {
        // Billing info may not be available for community users
      } finally {
        setLoading(false);
      }
    }
    fetchBilling();
  }, []);

  async function openBillingPortal() {
    setPortalLoading(true);
    try {
      const data = await api.post<{ url: string }>('/api/v1/license/billing-portal');
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        toast({ title: 'Unable to open billing portal', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Billing portal unavailable', description: 'This feature requires an active subscription.', variant: 'destructive' });
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Billing & Payments</h1>
            <p className="text-muted-foreground">Manage your subscription, payment methods, and invoices</p>
          </div>
        </div>

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>Your active subscription details</CardDescription>
              </div>
              <Badge variant={isPro ? 'default' : 'secondary'} className="text-sm">
                {edition === 'pro' ? 'Pro' : edition === 'enterprise' ? 'Enterprise' : 'Community'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {billing ? (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <p className="font-medium">{billing.plan}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Billing Cycle</p>
                    <p className="font-medium capitalize">{billing.interval}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-medium">{formatCurrency(billing.amount, billing.currency)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Next Billing Date</p>
                    <p className="font-medium">{formatDate(billing.currentPeriodEnd, tz)}</p>
                  </div>
                </div>
                {billing.cancelAtPeriodEnd && (
                  <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Your subscription will be downgraded at the end of the current billing period.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                {isPro
                  ? 'Billing information is loading...'
                  : 'You are on the free Community plan. Upgrade to Pro for advanced features.'}
              </div>
            )}
            <div className="flex gap-3">
              {!isPro && (
                <Button asChild>
                  <a href="/settings/license">Upgrade to Pro</a>
                </Button>
              )}
              {isPro && (
                <Button variant="outline" onClick={openBillingPortal} disabled={portalLoading || isDemo}>
                  {portalLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Manage Subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>Your current payment method on file</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {billing?.paymentMethod ? (
              <div className="flex items-center gap-4 rounded-md border p-4">
                {billing.paymentMethod.type === 'card' ? (
                  <>
                    <CreditCard className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium capitalize">{billing.paymentMethod.brand} ending in {billing.paymentMethod.last4}</p>
                      <p className="text-sm text-muted-foreground">Credit / Debit Card</p>
                    </div>
                  </>
                ) : billing.paymentMethod.type === 'crypto' ? (
                  <>
                    <Wallet className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium font-mono text-sm">{billing.paymentMethod.walletAddress}</p>
                      <p className="text-sm text-muted-foreground">Web3 Wallet (ETH/USDC)</p>
                    </div>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Payment method on file</p>
                      <p className="text-sm text-muted-foreground">{billing.paymentMethod.type}</p>
                    </div>
                  </>
                )}
                <div className="ml-auto">
                  <Button variant="ghost" size="sm" onClick={openBillingPortal} disabled={portalLoading || isDemo}>
                    Update
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CreditCard className="h-10 w-10 text-muted-foreground/40" />
                <div>
                  <p className="font-medium">No payment method</p>
                  <p className="text-sm text-muted-foreground">
                    {isPro ? 'Add a payment method via the billing portal.' : 'Add a payment method when you upgrade to Pro.'}
                  </p>
                </div>
              </div>
            )}

            {/* Web3 Wallet Section (x402) */}
            <Separator />
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Web3 Wallet</p>
                    <p className="text-xs text-muted-foreground">Pay with ETH or USDC on Ethereum / Base</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">Coming Soon</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Connect a Web3 wallet to pay for your subscription with cryptocurrency and bind your license to your wallet address.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Billing History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Billing History</CardTitle>
                <CardDescription>Past invoices and payment receipts</CardDescription>
              </div>
              {isPro && (
                <Button variant="ghost" size="sm" onClick={openBillingPortal} disabled={portalLoading || isDemo}>
                  <Receipt className="mr-2 h-4 w-4" />
                  View All Invoices
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {invoices.length > 0 ? (
              <div className="space-y-2">
                {invoices.slice(0, 10).map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-md border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{formatDate(inv.date, tz)}</p>
                        <p className="text-xs text-muted-foreground capitalize">{inv.status}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{formatCurrency(inv.amount, inv.currency)}</span>
                      {inv.pdfUrl && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer">
                            PDF
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Receipt className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No invoices yet</p>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
