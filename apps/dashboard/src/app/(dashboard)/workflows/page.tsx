import { GitBranch } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/breadcrumb';

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center gap-3">
        <GitBranch className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">Automate your business processes</p>
        </div>
      </div>
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        Workflow management interface coming soon
      </div>
    </div>
  );
}
