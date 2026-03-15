'use client';

import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from '@unicore/ui';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { api } from '@/lib/api';

interface LicenseInfo {
  key: string;
  edition: string;
  expiry: string;
  maxAgents: number;
  maxRoles: number;
  features: Record<string, boolean>;
}

export default function AdminLicensePage() {
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<LicenseInfo>('/admin/license')
      .then(setLicense)
      .catch(() => setLicense(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <div className="flex items-center gap-3">
        <Crown className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">License</h1>
          <p className="text-muted-foreground">
            View your current license and usage limits
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Loading license info...
        </p>
      ) : !license ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No license information available. The license API endpoint may not
              be available yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">License Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Edition</span>
                <Badge variant={license.edition === 'pro' ? 'default' : 'secondary'}>
                  {license.edition}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">License Key</span>
                <span className="font-mono text-xs select-all">
                  {license.key}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Expires</span>
                <span className="text-sm">
                  {new Date(license.expiry).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Usage Limits</CardTitle>
              <CardDescription>
                Current plan allowances
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Max Agents</span>
                <span className="text-sm font-medium">{license.maxAgents}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Max Roles</span>
                <span className="text-sm font-medium">{license.maxRoles}</span>
              </div>
            </CardContent>
          </Card>

          {license.features && Object.keys(license.features).length > 0 && (
            <Card className="sm:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Feature Flags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(license.features).map(([feature, enabled]) => (
                    <Badge
                      key={feature}
                      variant={enabled ? 'default' : 'outline'}
                    >
                      {feature}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
