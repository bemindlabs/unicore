'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Menu, Plus, Star, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  toast,
} from '@unicore/ui';

interface RichMenuArea {
  label: string;
  actionType: 'message' | 'uri' | 'postback';
  actionData: string;
}

interface RichMenuConfig {
  id: string;
  name: string;
  size: 'full' | 'half';
  chatBarText: string;
  areas: RichMenuArea[];
  isDefault: boolean;
}

const SIZES: Record<string, { width: number; height: number; label: string }> = {
  full: { width: 2500, height: 1686, label: 'Full (2500x1686)' },
  half: { width: 2500, height: 843, label: 'Half (2500x843)' },
};

function createEmptyArea(): RichMenuArea {
  return { label: '', actionType: 'message', actionData: '' };
}

function generateId(): string {
  return `rm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function LineRichMenu() {
  const [menus, setMenus] = useState<RichMenuConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formSize, setFormSize] = useState<'full' | 'half'>('full');
  const [formChatBarText, setFormChatBarText] = useState('Menu');
  const [formAreaCount, setFormAreaCount] = useState(1);
  const [formAreas, setFormAreas] = useState<RichMenuArea[]>([createEmptyArea()]);

  useEffect(() => {
    api
      .get<{ menus: RichMenuConfig[] }>('/api/v1/settings/line-rich-menus')
      .then((data) => setMenus(data.menus ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const persistMenus = useCallback(
    async (updated: RichMenuConfig[]) => {
      setIsSaving(true);
      try {
        await api.put('/api/v1/settings/line-rich-menus', { menus: updated });
        setMenus(updated);
      } catch (err) {
        toast({
          title: 'Failed to save',
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const openCreateDialog = useCallback(() => {
    setEditId(null);
    setFormName('');
    setFormSize('full');
    setFormChatBarText('Menu');
    setFormAreaCount(1);
    setFormAreas([createEmptyArea()]);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((menu: RichMenuConfig) => {
    setEditId(menu.id);
    setFormName(menu.name);
    setFormSize(menu.size);
    setFormChatBarText(menu.chatBarText);
    setFormAreaCount(menu.areas.length);
    setFormAreas(menu.areas.map((a) => ({ ...a })));
    setDialogOpen(true);
  }, []);

  const handleAreaCountChange = useCallback(
    (count: number) => {
      setFormAreaCount(count);
      setFormAreas((prev) => {
        if (count > prev.length) {
          return [...prev, ...Array.from({ length: count - prev.length }, () => createEmptyArea())];
        }
        return prev.slice(0, count);
      });
    },
    [],
  );

  const updateArea = useCallback((index: number, field: keyof RichMenuArea, value: string) => {
    setFormAreas((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    );
  }, []);

  const handleSaveMenu = useCallback(async () => {
    if (!formName.trim()) {
      toast({ title: 'Missing name', description: 'Enter a menu name.' });
      return;
    }

    const menu: RichMenuConfig = {
      id: editId ?? generateId(),
      name: formName.trim(),
      size: formSize,
      chatBarText: formChatBarText.trim() || 'Menu',
      areas: formAreas,
      isDefault: editId ? menus.find((m) => m.id === editId)?.isDefault ?? false : false,
    };

    const updated = editId
      ? menus.map((m) => (m.id === editId ? menu : m))
      : [...menus, menu];

    await persistMenus(updated);
    setDialogOpen(false);
    toast({ title: editId ? 'Menu updated' : 'Menu created' });
  }, [editId, formName, formSize, formChatBarText, formAreas, menus, persistMenus]);

  const handleDelete = useCallback(
    async (id: string) => {
      const updated = menus.filter((m) => m.id !== id);
      await persistMenus(updated);
      toast({ title: 'Menu deleted' });
    },
    [menus, persistMenus],
  );

  const handleSetDefault = useCallback(
    async (id: string) => {
      const updated = menus.map((m) => ({ ...m, isDefault: m.id === id }));
      await persistMenus(updated);
      toast({ title: 'Default menu updated' });
    },
    [menus, persistMenus],
  );

  const formValid = formName.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Menu className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">LINE Rich Menus</CardTitle>
          </div>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="mr-1 h-4 w-4" />
            Create Rich Menu
          </Button>
        </div>
        <CardDescription>
          Manage Rich Menu layouts that appear at the bottom of the LINE chat.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : menus.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No rich menus configured yet. Create one to get started.
          </p>
        ) : (
          menus.map((menu) => (
            <div
              key={menu.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{menu.name}</span>
                  {menu.isDefault && (
                    <span className="inline-flex items-center rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      <Star className="mr-1 h-3 w-3" />
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {SIZES[menu.size]?.label} &middot; {menu.areas.length} area
                  {menu.areas.length !== 1 ? 's' : ''} &middot; Chat bar: &quot;{menu.chatBarText}&quot;
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!menu.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetDefault(menu.id)}
                    disabled={isSaving}
                  >
                    Set as Default
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(menu)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(menu.id)}
                  disabled={isSaving}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Rich Menu' : 'Create Rich Menu'}</DialogTitle>
            <DialogDescription>
              Configure the menu layout and actions for each area.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Menu Name */}
            <div className="space-y-2">
              <Label htmlFor="rm-name">Menu Name</Label>
              <Input
                id="rm-name"
                placeholder="Main Menu"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {/* Size */}
            <div className="space-y-2">
              <Label>Size</Label>
              <Select value={formSize} onValueChange={(v) => setFormSize(v as 'full' | 'half')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full (2500x1686)</SelectItem>
                  <SelectItem value="half">Half (2500x843)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Chat Bar Text */}
            <div className="space-y-2">
              <Label htmlFor="rm-chatbar">Chat Bar Text</Label>
              <Input
                id="rm-chatbar"
                placeholder="Menu"
                value={formChatBarText}
                onChange={(e) => setFormChatBarText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Text shown at the bottom of the LINE chat to toggle the menu.
              </p>
            </div>

            {/* Number of Areas */}
            <div className="space-y-2">
              <Label>Number of Areas</Label>
              <Select
                value={String(formAreaCount)}
                onValueChange={(v) => handleAreaCountChange(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} area{n !== 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Area Definitions */}
            {formAreas.map((area, i) => (
              <div key={i} className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">Area {i + 1}</p>

                <div className="space-y-2">
                  <Label htmlFor={`rm-area-label-${i}`}>Label</Label>
                  <Input
                    id={`rm-area-label-${i}`}
                    placeholder="Button label"
                    value={area.label}
                    onChange={(e) => updateArea(i, 'label', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Action Type</Label>
                  <Select
                    value={area.actionType}
                    onValueChange={(v) => updateArea(i, 'actionType', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="message">Message</SelectItem>
                      <SelectItem value="uri">URI</SelectItem>
                      <SelectItem value="postback">Postback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`rm-area-data-${i}`}>
                    {area.actionType === 'uri'
                      ? 'URL'
                      : area.actionType === 'postback'
                        ? 'Postback Data'
                        : 'Message Text'}
                  </Label>
                  <Input
                    id={`rm-area-data-${i}`}
                    placeholder={
                      area.actionType === 'uri'
                        ? 'https://example.com'
                        : area.actionType === 'postback'
                          ? 'action=buy&itemid=123'
                          : 'Hello!'
                    }
                    value={area.actionData}
                    onChange={(e) => updateArea(i, 'actionData', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMenu} disabled={!formValid || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : editId ? (
                'Update Menu'
              ) : (
                'Create Menu'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
