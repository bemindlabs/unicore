import { Bot } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/breadcrumb';

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Agents</h1>
          <p className="text-muted-foreground">Manage and monitor your AI agents</p>
        </div>
      </div>
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        Agent management interface coming soon
      </div>
    </div>
  );
}
