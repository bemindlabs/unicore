'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SignupForm } from '@/components/auth/signup-form';
import { useAuth } from '@/hooks/use-auth';
import { useSaas } from '@/contexts/saas-context';

/**
 * SaaS signup page (M4/E5). Available only in saas mode — in self-host
 * (single default tenant, open-core) self-serve signup is a no-op and the
 * page points the visitor to login.
 */
export default function SignupPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isSaas } = useSaas();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isSaas) {
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Self-hosted instance</h1>
        <p className="text-sm text-muted-foreground">
          Self-serve signup is only available on the hosted UniCore SaaS. On a
          self-hosted instance, your workspace is created during first-run setup.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return <SignupForm />;
}
