'use client';

import { Shield } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@unicore/ui';
const ROLES = [
  {
    name: 'Owner',
    description: 'Full platform access. Can manage users, billing, and all settings.',
    permissions: ['All permissions'],
    variant: 'default' as const,
  },
  {
    name: 'Operator',
    description: 'Day-to-day operations. Access to agents, workflows, contacts, orders, and inventory.',
    permissions: ['Agents', 'Workflows', 'Contacts', 'Orders', 'Inventory'],
    variant: 'secondary' as const,
  },
  {
    name: 'Marketer',
    description: 'Marketing and outreach. Access to contacts and communication tools.',
    permissions: ['Contacts', 'Dashboard'],
    variant: 'outline' as const,
  },
  {
    name: 'Finance',
    description: 'Financial operations. Access to invoicing and financial reports.',
    permissions: ['Invoicing', 'Dashboard'],
    variant: 'outline' as const,
  },
  {
    name: 'Viewer',
    description: 'Read-only access to the dashboard.',
    permissions: ['Dashboard (read-only)'],
    variant: 'outline' as const,
  },
];

export default function AdminRolesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roles & Access</h1>
          <p className="text-muted-foreground">
            Platform roles and their permission levels
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES.map((role) => (
          <Card key={role.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{role.name}</CardTitle>
                <Badge variant={role.variant}>{role.name}</Badge>
              </div>
              <CardDescription>{role.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {role.permissions.map((p) => (
                  <Badge key={p} variant="secondary" className="text-xs">
                    {p}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
