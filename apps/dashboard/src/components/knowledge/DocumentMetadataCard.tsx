'use client';

import { FileText, Link, File, Hash, HardDrive, BookOpen, User, Calendar } from 'lucide-react';
import { Badge } from '@unicore/ui';
import { useBusinessTimezone, formatDateTimeTz } from '@/hooks/use-business-timezone';

export interface DocumentMeta {
  id: string;
  title: string;
  type: string;
  chunkCount: number;
  createdAt: string;
  source?: string;
  author?: string;
  fileType?: string;
  size?: number;
  pages?: number;
  workspaceId?: string;
}

interface DocumentMetadataCardProps {
  doc: DocumentMeta;
}

function typeIcon(type: string) {
  switch (type?.toLowerCase()) {
    case 'url': return <Link className="h-4 w-4 text-blue-500" />;
    case 'pdf': return <File className="h-4 w-4 text-red-500" />;
    default: return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentMetadataCard({ doc }: DocumentMetadataCardProps): JSX.Element {
  const tz = useBusinessTimezone();
  const rows: { icon: React.ReactNode; label: string; value: string }[] = [];

  if (doc.source) {
    rows.push({ icon: <Link className="h-3.5 w-3.5" />, label: 'Source', value: doc.source });
  }
  if (doc.fileType) {
    rows.push({ icon: <FileText className="h-3.5 w-3.5" />, label: 'File type', value: doc.fileType });
  }
  if (doc.size != null) {
    rows.push({ icon: <HardDrive className="h-3.5 w-3.5" />, label: 'Size', value: formatBytes(doc.size) });
  }
  if (doc.pages != null) {
    rows.push({ icon: <BookOpen className="h-3.5 w-3.5" />, label: 'Pages', value: String(doc.pages) });
  }
  rows.push({ icon: <Hash className="h-3.5 w-3.5" />, label: 'Chunks', value: String(doc.chunkCount ?? 0) });
  if (doc.author) {
    rows.push({ icon: <User className="h-3.5 w-3.5" />, label: 'Author', value: doc.author });
  }
  if (doc.createdAt) {
    rows.push({
      icon: <Calendar className="h-3.5 w-3.5" />,
      label: 'Ingested',
      value: formatDateTimeTz(doc.createdAt, tz),
    });
  }
  if (doc.workspaceId) {
    rows.push({ icon: <Hash className="h-3.5 w-3.5" />, label: 'Workspace', value: doc.workspaceId });
  }

  return (
    <div className="mt-3 rounded-md border bg-muted/40 p-3 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        {typeIcon(doc.type)}
        <span className="text-xs font-semibold text-foreground">{doc.title}</span>
        <Badge variant="secondary" className="text-xs ml-auto capitalize">{doc.type}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {rows.map(({ icon, label, value }) => (
          <div key={label} className="flex items-start gap-1.5 text-muted-foreground">
            <span className="mt-0.5 shrink-0 text-muted-foreground/60">{icon}</span>
            <span className="font-medium text-foreground/70">{label}:</span>
            <span className="truncate">{value}</span>
          </div>
        ))}
      </dl>
    </div>
  );
}
