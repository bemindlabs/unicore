import { Users } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/breadcrumb';

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">Manage your CRM contacts and leads</p>
        </div>
      </div>
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        Contact management interface coming soon
      </div>
    </div>
  );
}
