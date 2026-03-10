import type { UniCoreConfig } from '@unicore/shared-types';

const BOOTSTRAP_API = process.env.NEXT_PUBLIC_BOOTSTRAP_URL ?? 'http://localhost:4500';

export async function provisionWorkspace(config: UniCoreConfig): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${BOOTSTRAP_API}/provision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Provisioning failed' }));
    return { success: false, message: error.message ?? 'Provisioning failed' };
  }

  return { success: true };
}
