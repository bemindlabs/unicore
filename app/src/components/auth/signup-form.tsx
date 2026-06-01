'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
} from '@bemindlabs/unicore-ui';
import { useAuth } from '@/hooks/use-auth';
import { track } from '@/lib/analytics';

/** Card-less trial plan the signup endpoint starts (mirrors gateway TRIAL_PLAN). */
const TRIAL_PLAN = 'growth';

/**
 * Card-less SaaS signup (M4/E5, wires the M3 `/auth/signup` endpoint).
 *
 * No card up front (per MVP trial spec §2): collect name / business / email /
 * password, create the tenant + OWNER + 30-day trial, log the user in, then route
 * into the existing bootstrap wizard for first-run setup.
 */
export function SignupForm() {
  const { signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await signup({
        name,
        email,
        password,
        businessName: businessName.trim() || undefined,
      });
      // Funnel analytics (FU-02): card-less signup succeeded → trial started.
      // No-ops unless an analytics transport is configured (see @/lib/analytics).
      // tenantId is not on the signup response DTO; userId is the closest signal.
      track('trial_started', { plan: TRIAL_PLAN, userId: user?.id ?? null });
      // First-run setup: hand off to the per-tenant bootstrap wizard.
      router.replace('/wizard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center space-y-2 lg:items-start">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg lg:hidden">
          U
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Start your free trial</h1>
        <p className="text-sm text-muted-foreground">
          30 days, full features, no credit card required.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your name <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                type="text"
                placeholder="Acme Co. (optional)"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Must include an uppercase letter, a lowercase letter, and a number.
              </p>
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating your workspace…' : 'Create account'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
