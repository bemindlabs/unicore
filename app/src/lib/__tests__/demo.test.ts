import { isDemoMode } from '../demo';

/**
 * Demo-mode signal (Phase 5 / W3). `isDemoMode` is the client-side hint that
 * the dashboard is running in the seeded demo tenant; the backend DemoModeGuard
 * stays the authoritative block. Driven by NEXT_PUBLIC_EDITION=demo or the demo
 * admin email.
 */
describe('isDemoMode', () => {
  const original = process.env.NEXT_PUBLIC_EDITION;

  afterEach(() => {
    process.env.NEXT_PUBLIC_EDITION = original;
  });

  it('is true when NEXT_PUBLIC_EDITION=demo regardless of email', () => {
    process.env.NEXT_PUBLIC_EDITION = 'demo';
    expect(isDemoMode(undefined)).toBe(true);
    expect(isDemoMode('someone@example.com')).toBe(true);
  });

  it('is true for the demo admin email', () => {
    process.env.NEXT_PUBLIC_EDITION = '';
    expect(isDemoMode('admin@unicore.dev')).toBe(true);
  });

  it('is false for a normal user outside the demo edition', () => {
    process.env.NEXT_PUBLIC_EDITION = '';
    expect(isDemoMode('owner@acme.com')).toBe(false);
    expect(isDemoMode(null)).toBe(false);
    expect(isDemoMode(undefined)).toBe(false);
  });
});
