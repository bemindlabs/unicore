import { FileText } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/breadcrumb';

export default function InvoicingPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoicing</h1>
          <p className="text-muted-foreground">Create and manage invoices</p>
        </div>
      </div>
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        Invoicing interface coming soon
      </div>
    </div>
  );
}
