'use client';

import { useCallback, useState } from 'react';
import { Building2, Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  toast,
} from '@bemindlabs/unicore-ui';
import { useTenants } from '@/hooks/use-tenants';

/**
 * Workspace (business) switcher — Phase 5 / W2.
 *
 * Lists the user's businesses (GET /tenants), shows the active one, switches
 * between them (POST /tenants/switch → new token → reload), and creates a new
 * business (POST /tenants → onboarding wizard). A solopreneur can run several
 * businesses on one login and flip the active context here.
 */
export function WorkspaceSwitcher() {
  const { tenants, active, loading, busy, switchTo, create } = useTenants();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSwitch = useCallback(
    async (tenantId: string) => {
      if (tenantId === active?.tenantId) return;
      try {
        await switchTo(tenantId);
      } catch (err) {
        toast({
          title: 'Could not switch business',
          description: (err as Error).message,
          variant: 'destructive',
        });
      }
    },
    [active?.tenantId, switchTo],
  );

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const tenantId = await create(name);
      setCreateOpen(false);
      setNewName('');
      // Switch into the new business (re-issues a token scoped to it) and land
      // on the onboarding wizard so the owner configures the fresh workspace.
      toast({ title: `Created "${name}"`, description: 'Setting up your new business…' });
      await switchTo(tenantId, '/wizard');
    } catch (err) {
      toast({
        title: 'Could not create business',
        description: (err as Error).message,
        variant: 'destructive',
      });
      setCreating(false);
    }
  }, [newName, create, switchTo]);

  // Single business and no super-admin reason to show a picker → keep it simple.
  if (loading) {
    return (
      <div className="hidden sm:flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="hidden md:inline">Loading…</span>
      </div>
    );
  }

  if (tenants.length === 0) return null;

  const activeName = active?.name ?? tenants[0]?.name ?? 'Workspace';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:flex h-8 max-w-[180px] items-center gap-2 px-2"
            aria-label="Switch business"
            disabled={busy}
          >
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{activeName}</span>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="start">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Your businesses
          </DropdownMenuLabel>
          {tenants.map((t) => (
            <DropdownMenuItem
              key={t.tenantId}
              onClick={() => handleSwitch(t.tenantId)}
              className="flex items-center gap-2"
            >
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t.plan} · {t.role}
                </span>
              </div>
              {t.isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setCreateOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create new business
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a new business</DialogTitle>
            <DialogDescription>
              Spin up a fresh workspace with its own trial. You become its owner and
              can switch to it any time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="business-name">Business name</Label>
            <Input
              id="business-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Acme Coffee Co."
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create & switch'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
