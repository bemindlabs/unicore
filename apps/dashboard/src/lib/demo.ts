'use client';

/**
 * Returns true when the dashboard is running in demo mode.
 * Demo mode is active if:
 *   - The NEXT_PUBLIC_EDITION env var is set to "demo", OR
 *   - The currently-authenticated user's email is admin@unicore.dev
 */
export function isDemoMode(email?: string | null): boolean {
  if (process.env.NEXT_PUBLIC_EDITION === 'demo') {
    return true;
  }
  if (email === 'admin@unicore.dev') {
    return true;
  }
  return false;
}
