'use client';

import { useCallback, useEffect, useState } from 'react';
import { Code2, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
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
  Textarea,
  toast,
} from '@unicore/ui';

interface FlexTemplate {
  id: string;
  name: string;
  type: 'bubble' | 'carousel';
  altText: string;
  contents: string; // JSON string
}

function generateId(): string {
  return `ft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Pre-built Templates ──────────────────────────────────────────────

const PREBUILT_PRODUCT_CARD = JSON.stringify(
  {
    type: 'bubble',
    hero: {
      type: 'image',
      url: 'https://via.placeholder.com/1024x576',
      size: 'full',
      aspectRatio: '16:9',
      aspectMode: 'cover',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: 'Product Name', weight: 'bold', size: 'xl' },
        { type: 'text', text: 'Short description of the product.', size: 'sm', color: '#999999', margin: 'md' },
        {
          type: 'box',
          layout: 'baseline',
          margin: 'md',
          contents: [
            { type: 'text', text: '$29.99', size: 'lg', weight: 'bold', color: '#1DB446' },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          action: { type: 'uri', label: 'Buy Now', uri: 'https://example.com/buy' },
        },
      ],
    },
  },
  null,
  2,
);

const PREBUILT_ORDER_CONFIRMATION = JSON.stringify(
  {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: 'Order Confirmation', weight: 'bold', size: 'xl', color: '#1DB446' },
        { type: 'separator', margin: 'md' },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'md',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: 'Order ID', size: 'sm', color: '#999999', flex: 1 },
                { type: 'text', text: '#ORD-12345', size: 'sm', flex: 2 },
              ],
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'sm',
              contents: [
                { type: 'text', text: 'Status', size: 'sm', color: '#999999', flex: 1 },
                { type: 'text', text: 'Confirmed', size: 'sm', color: '#1DB446', flex: 2 },
              ],
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'sm',
              contents: [
                { type: 'text', text: 'Total', size: 'sm', color: '#999999', flex: 1 },
                { type: 'text', text: '$59.98', size: 'sm', weight: 'bold', flex: 2 },
              ],
            },
          ],
        },
      ],
    },
  },
  null,
  2,
);

const PREBUILT_RECEIPT = JSON.stringify(
  {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: 'Receipt', weight: 'bold', size: 'xl' },
        { type: 'text', text: 'UniCore Store', size: 'xs', color: '#999999' },
        { type: 'separator', margin: 'lg' },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: 'Widget A x2', size: 'sm', flex: 3 },
                { type: 'text', text: '$19.98', size: 'sm', align: 'end', flex: 1 },
              ],
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'sm',
              contents: [
                { type: 'text', text: 'Widget B x1', size: 'sm', flex: 3 },
                { type: 'text', text: '$39.99', size: 'sm', align: 'end', flex: 1 },
              ],
            },
          ],
        },
        { type: 'separator', margin: 'lg' },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'lg',
          contents: [
            { type: 'text', text: 'Total', size: 'md', weight: 'bold', flex: 3 },
            { type: 'text', text: '$59.97', size: 'md', weight: 'bold', align: 'end', flex: 1 },
          ],
        },
      ],
    },
  },
  null,
  2,
);

const PREBUILT_TEMPLATES: { label: string; type: 'bubble' | 'carousel'; altText: string; contents: string }[] = [
  { label: 'Product Card', type: 'bubble', altText: 'Product details', contents: PREBUILT_PRODUCT_CARD },
  { label: 'Order Confirmation', type: 'bubble', altText: 'Order confirmation', contents: PREBUILT_ORDER_CONFIRMATION },
  { label: 'Receipt', type: 'bubble', altText: 'Receipt', contents: PREBUILT_RECEIPT },
];

// ── Component ────────────────────────────────────────────────────────

export function LineFlexTemplates() {
  const [templates, setTemplates] = useState<FlexTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'bubble' | 'carousel'>('bubble');
  const [formAltText, setFormAltText] = useState('');
  const [formContents, setFormContents] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ templates: FlexTemplate[] }>('/settings/line-flex-templates')
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const persistTemplates = useCallback(async (updated: FlexTemplate[]) => {
    setIsSaving(true);
    try {
      await api.put('/settings/line-flex-templates', { templates: updated });
      setTemplates(updated);
    } catch (err) {
      toast({
        title: 'Failed to save',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  }, []);

  const validateJson = useCallback((value: string): boolean => {
    if (!value.trim()) {
      setJsonError(null);
      return false;
    }
    try {
      JSON.parse(value);
      setJsonError(null);
      return true;
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
      return false;
    }
  }, []);

  const openCreateDialog = useCallback(() => {
    setEditId(null);
    setFormName('');
    setFormType('bubble');
    setFormAltText('');
    setFormContents('');
    setJsonError(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((tpl: FlexTemplate) => {
    setEditId(tpl.id);
    setFormName(tpl.name);
    setFormType(tpl.type);
    setFormAltText(tpl.altText);
    setFormContents(tpl.contents);
    setJsonError(null);
    setDialogOpen(true);
  }, []);

  const applyPrebuilt = useCallback(
    (prebuilt: (typeof PREBUILT_TEMPLATES)[number]) => {
      setFormType(prebuilt.type);
      setFormAltText(prebuilt.altText);
      setFormContents(prebuilt.contents);
      setJsonError(null);
      if (!formName.trim()) {
        setFormName(prebuilt.label);
      }
    },
    [formName],
  );

  const handleSaveTemplate = useCallback(async () => {
    if (!formName.trim()) {
      toast({ title: 'Missing name', description: 'Enter a template name.' });
      return;
    }
    if (!formContents.trim()) {
      toast({ title: 'Missing contents', description: 'Enter the Flex Message JSON.' });
      return;
    }
    if (!validateJson(formContents)) {
      toast({ title: 'Invalid JSON', description: 'Fix the JSON before saving.' });
      return;
    }

    const tpl: FlexTemplate = {
      id: editId ?? generateId(),
      name: formName.trim(),
      type: formType,
      altText: formAltText.trim() || formName.trim(),
      contents: formContents,
    };

    const updated = editId
      ? templates.map((t) => (t.id === editId ? tpl : t))
      : [...templates, tpl];

    await persistTemplates(updated);
    setDialogOpen(false);
    toast({ title: editId ? 'Template updated' : 'Template created' });
  }, [editId, formName, formType, formAltText, formContents, templates, persistTemplates, validateJson]);

  const handleDelete = useCallback(
    async (id: string) => {
      const updated = templates.filter((t) => t.id !== id);
      await persistTemplates(updated);
      toast({ title: 'Template deleted' });
    },
    [templates, persistTemplates],
  );

  const formValid = formName.trim().length > 0 && formContents.trim().length > 0 && !jsonError;

  // Attempt to pretty-print the JSON for the preview
  let previewJson = '';
  try {
    previewJson = JSON.stringify(JSON.parse(formContents), null, 2);
  } catch {
    previewJson = formContents;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">LINE Flex Message Templates</CardTitle>
          </div>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="mr-1 h-4 w-4" />
            New Template
          </Button>
        </div>
        <CardDescription>
          Manage reusable Flex Message templates for rich LINE messages.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No templates yet. Create one or start from a pre-built template.
          </p>
        ) : (
          templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{tpl.name}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {tpl.type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Alt: &quot;{tpl.altText}&quot;
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(tpl)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(tpl.id)}
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Template' : 'New Flex Message Template'}</DialogTitle>
            <DialogDescription>
              Define a Flex Message template using LINE&apos;s JSON format.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Template Name */}
            <div className="space-y-2">
              <Label htmlFor="ft-name">Template Name</Label>
              <Input
                id="ft-name"
                placeholder="Welcome Message"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label>Template Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as 'bubble' | 'carousel')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bubble">Bubble</SelectItem>
                  <SelectItem value="carousel">Carousel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Alt Text */}
            <div className="space-y-2">
              <Label htmlFor="ft-alt">Alt Text</Label>
              <Input
                id="ft-alt"
                placeholder="Shown when Flex can't render"
                value={formAltText}
                onChange={(e) => setFormAltText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Fallback text displayed in push notifications and older clients.
              </p>
            </div>

            {/* Pre-built templates */}
            <div className="space-y-2">
              <Label>Start from a Pre-built Template</Label>
              <div className="flex flex-wrap gap-2">
                {PREBUILT_TEMPLATES.map((pb) => (
                  <Button
                    key={pb.label}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPrebuilt(pb)}
                  >
                    {pb.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* JSON Editor */}
            <div className="space-y-2">
              <Label htmlFor="ft-json">Flex Message JSON</Label>
              <Textarea
                id="ft-json"
                className="min-h-[200px] font-mono text-xs"
                placeholder='{ "type": "bubble", ... }'
                value={formContents}
                onChange={(e) => {
                  setFormContents(e.target.value);
                  validateJson(e.target.value);
                }}
              />
              {jsonError && (
                <p className="text-xs text-destructive">{jsonError}</p>
              )}
            </div>

            {/* Preview */}
            {formContents.trim() && !jsonError && (
              <div className="space-y-2">
                <Label>JSON Preview</Label>
                <pre className="max-h-[200px] overflow-auto rounded-lg bg-muted p-3 text-xs">
                  {previewJson}
                </pre>
              </div>
            )}
          </div>

          <Separator />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={!formValid || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : editId ? (
                'Update Template'
              ) : (
                'Save Template'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
