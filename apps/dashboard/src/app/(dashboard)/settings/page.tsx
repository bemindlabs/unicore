import { Settings } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/breadcrumb';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Configure your UniCore platform</p>
        </div>
      </div>
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        Settings interface coming soon
      </div>
    </div>
  );
}
