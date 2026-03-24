'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { siteConfig } from '@/lib/site-config';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (licenseKey) {
        const licRes = await fetch(`${siteConfig.licenseApiUrl}/api/v1/licenses/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: licenseKey }),
        });
        const licData = await licRes.json();

        if (!licRes.ok) {
          setError('Invalid license key.');
          return;
        }

        if (!licData.features?.aiDlc) {
          setError('This license does not include the AI-DLC add-on. Please upgrade your plan.');
          return;
        }
      }

      const res = await fetch(`${siteConfig.apiGatewayUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, licenseKey }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Registration failed');
        return;
      }

      localStorage.setItem('dlc_token', data.access_token);
      localStorage.setItem('dlc_user', JSON.stringify(data.user));
      router.push('/portal');
    } catch {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Zap className="h-6 w-6 text-blue-500" />
            <span className="text-lg font-bold text-zinc-50">UniCore AI-DLC</span>
          </Link>
          <p className="mt-2 text-sm text-zinc-400">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</div>
          )}

          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-medium text-zinc-400">Name</label>
            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder-zinc-600 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              placeholder="Your name" />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-zinc-400">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder-zinc-600 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              placeholder="you@example.com" />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-zinc-400">Password</label>
            <div className="relative">
              <input id="password" type={showPassword ? 'text' : 'password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 pr-10 text-sm text-zinc-50 placeholder-zinc-600 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                placeholder="Min 8 chars, uppercase + number" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="licenseKey" className="mb-1 block text-xs font-medium text-zinc-400">
              License Key <span className="text-zinc-600">(optional)</span>
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <input id="licenseKey" type="text" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-2 pl-10 pr-3 text-sm font-mono text-zinc-50 placeholder-zinc-600 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                placeholder="UC-XXXX-XXXX-XXXX-XXXX" />
            </div>
            <p className="mt-1 text-[11px] text-zinc-600">Enter your license key to activate AI-DLC features.</p>
          </div>

          <button type="submit" disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create Account
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-500 hover:text-blue-400">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
