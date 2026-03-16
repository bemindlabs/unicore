"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@unicore/ui";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContactType = "LEAD" | "CUSTOMER" | "VENDOR" | "PARTNER";

interface Contact {
  id: string;
  type: ContactType;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  website?: string;
  avatarUrl?: string;
  country?: string;
  region?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  tags?: string[];
  leadStage?: string;
  leadScore?: number;
  dealValue?: number;
  currency?: string;
  followUpAt?: string;
  source?: string;
  parentId?: string;
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string | null;
}

interface ContactForm {
  type: ContactType;
  name: string;
  email: string;
  phone: string;
  company: string;
}

const EMPTY_FORM: ContactForm = {
  type: "LEAD",
  name: "",
  email: "",
  phone: "",
  company: "",
};

// ---------------------------------------------------------------------------
// Badge helper
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<ContactType, string> = {
  LEAD: "bg-blue-100 text-blue-800 border-blue-300",
  CUSTOMER: "bg-emerald-100 text-emerald-800 border-emerald-300",
  VENDOR: "bg-purple-100 text-purple-800 border-purple-300",
  PARTNER: "bg-amber-100 text-amber-800 border-amber-300",
};

function TypeBadge({ type }: { type: ContactType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[type]}`}
    >
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Contact Dialog (create / edit)
// ---------------------------------------------------------------------------

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Contact | null;
  onSaved: (contact: Contact) => void;
}

function ContactDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: ContactDialogProps) {
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              type: initial.type,
              name: initial.name,
              email: initial.email,
              phone: initial.phone ?? "",
              company: initial.company ?? "",
            }
          : EMPTY_FORM,
      );
    }
  }, [open, initial]);

  const set = (field: keyof ContactForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      const nameParts = form.name.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '-';
      const payload = {
        type: form.type,
        firstName,
        lastName,
        email: form.email.trim(),
        ...(form.phone.trim() && { phone: form.phone.trim() }),
        ...(form.company.trim() && { company: form.company.trim() }),
      };
      const saved = initial
        ? await api.put<Contact>(
            `/api/proxy/erp/contacts/${initial.id}`,
            payload,
          )
        : await api.post<Contact>("/api/proxy/erp/contacts", payload);
      onSaved(saved);
      onOpenChange(false);
      toast({ title: initial ? "Contact updated" : "Contact created" });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [form, initial, onSaved, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Contact" : "New Contact"}</DialogTitle>
          <DialogDescription>
            {initial
              ? "Update contact details."
              : "Add a new contact to your ERP."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="c-name">Name *</Label>
            <Input
              id="c-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Jane Doe"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-email">Email *</Label>
            <Input
              id="c-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="jane@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="c-phone">Phone</Label>
              <Input
                id="c-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+1 555 000"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-company">Company</Label>
              <Input
                id="c-company"
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-type">Type</Label>
            <select
              id="c-type"
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              {(["LEAD", "CUSTOMER", "VENDOR", "PARTNER"] as ContactType[]).map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!form.name.trim() || !form.email.trim() || saving}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  contact: Contact | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteDialog({ contact, onClose, onDeleted }: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!contact) return;
    setDeleting(true);
    try {
      await api.delete(`/api/proxy/erp/contacts/${contact.id}`);
      onDeleted(contact.id);
      onClose();
      toast({ title: "Contact deleted" });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }, [contact, onDeleted, onClose]);

  return (
    <Dialog open={!!contact} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Contact</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong>
              {contact?.name}
            </strong>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  useEffect(() => {
    api
      .get<Contact[]>("/api/proxy/erp/contacts")
      .then((res) => setContacts(Array.isArray(res) ? res : (res as any).data ?? []))
      .catch((err) =>
        toast({
          title: "Failed to load contacts",
          description: err.message,
          variant: "destructive",
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q)
    );
  });

  const handleSaved = useCallback((saved: Contact) => {
    setContacts((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    setDialogOpen(true);
  };
  const openEdit = (c: Contact) => {
    setEditTarget(c);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Contacts</CardTitle>
            </div>
            <CardDescription>
              {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Contact
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
              {search
                ? "No contacts match your search."
                : 'No contacts yet. Click "New Contact" to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-20">Score</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        {contact.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.email}
                      </TableCell>
                      <TableCell className="text-sm">
                        {contact.company ?? "—"}
                      </TableCell>
                      <TableCell>
                        <TypeBadge type={contact.type} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.leadScore ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(contact)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(contact)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editTarget}
        onSaved={handleSaved}
      />
      <DeleteDialog
        contact={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) =>
          setContacts((prev) => prev.filter((c) => c.id !== id))
        }
      />
    </div>
  );
}
