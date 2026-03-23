import { SystemTerminal } from '@/components/terminal/SystemTerminal';

export default function AdminTerminalPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="shrink-0 mb-4">
        <h1 className="text-2xl font-bold tracking-tight">System Terminal</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Run system admin commands — service health, logs, restarts, and diagnostics.
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <SystemTerminal />
      </div>
    </div>
  );
}
