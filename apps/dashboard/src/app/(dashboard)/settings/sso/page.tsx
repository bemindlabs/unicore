'use client';

import { Shield } from 'lucide-react';
import { UpgradeGate } from '@/components/upgrade-gate';

export default function SsoSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Single Sign-On</h1>
          <p className="text-muted-foreground">Configure SAML 2.0 and OIDC identity providers</p>
        </div>
      </div>

      <UpgradeGate
        feature="sso"
        featureTitle="Single Sign-On (SSO)"
        featureDescription="Connect your identity provider via SAML 2.0 or OIDC. Enable one-click login with Google Workspace, Okta, Azure AD, and more."
      >
        {/* SSO configuration UI — only shown when Pro */}
        <div className="space-y-4" />
      </UpgradeGate>
    </div>
  );
}
