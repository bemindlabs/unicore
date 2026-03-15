const BOOTSTRAP_API = process.env.NEXT_PUBLIC_BOOTSTRAP_URL ?? 'http://localhost:4500';

export interface ProvisionRequest {
  bootstrapSecret: string;
  businessName: string;
  template: string;
  industry?: string;
  locale: string;
  currency: string;
  timezone: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface ProvisionResult {
  success: boolean;
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  summary: {
    template: string;
    businessName: string;
    erpModulesEnabled: string[];
    agentsEnabled: string[];
    rolesEnabled: string[];
  };
  licenseKey?: string;
  message?: string;
}

export async function getTemplates(): Promise<unknown[]> {
  const res = await fetch(`${BOOTSTRAP_API}/templates`);
  if (!res.ok) throw new Error('Failed to load templates');
  return res.json();
}

export async function getTemplate(id: string): Promise<unknown> {
  const res = await fetch(`${BOOTSTRAP_API}/templates/${id}`);
  if (!res.ok) throw new Error(`Template '${id}' not found`);
  return res.json();
}

export async function provisionWorkspace(request: ProvisionRequest): Promise<ProvisionResult> {
  const res = await fetch(`${BOOTSTRAP_API}/provision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Provisioning failed' }));
    throw new Error(error.message ?? 'Provisioning failed');
  }

  return res.json();
}
