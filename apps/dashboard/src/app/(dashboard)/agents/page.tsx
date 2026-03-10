import Link from 'next/link';
import { Bot, ExternalLink } from 'lucide-react';
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
      <Link
        href="/backoffice"
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <Bot className="h-5 w-5" />
        <span>Open Backoffice — Pixel Art Team Overview</span>
        <ExternalLink className="h-4 w-4" />
      </Link>
    </div>
  );
}
