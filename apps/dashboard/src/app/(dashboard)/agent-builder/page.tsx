'use client';

import { useState, useCallback } from 'react';
import {
  Wand2, Plus, Pencil, Trash2, Loader2, Bot, Send, Save, Rocket,
  ChevronLeft, AlertCircle, CheckCircle2, Wrench, Sliders,
} from 'lucide-react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Input, Label, Badge, Textarea,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Separator,
} from '@bemindlabs/unicore-ui';
import { ProGate } from '@/components/license/pro-gate';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentStatus = 'draft' | 'live';
type AutonomyLevel = 1 | 2 | 3 | 4 | 5;

interface AgentTool {
  id: string;
  label: string;
  description: string;
}

interface CustomAgent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  autonomyLevel: AutonomyLevel;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_TOOLS: AgentTool[] = [
  { id: 'web_search', label: 'Web Search', description: 'Search the web for information' },
  { id: 'knowledge_base', label: 'Knowledge Base', description: 'Query your knowledge base documents' },
  { id: 'crm_read', label: 'CRM Read', description: 'Read contacts and CRM data' },
  { id: 'crm_write', label: 'CRM Write', description: 'Create and update CRM records' },
  { id: 'erp_read', label: 'ERP Read', description: 'Read orders, inventory, invoices' },
  { id: 'erp_write', label: 'ERP Write', description: 'Create and update ERP records' },
  { id: 'email_send', label: 'Send Email', description: 'Send emails via connected account' },
  { id: 'calendar', label: 'Calendar', description: 'Read and create calendar events' },
  { id: 'code_exec', label: 'Code Execution', description: 'Run sandboxed code snippets' },
  { id: 'file_read', label: 'File Access', description: 'Read uploaded files and documents' },
];

const AUTONOMY_LABELS: Record<AutonomyLevel, { label: string; color: string }> = {
  1: { label: 'Ask every step', color: 'text-blue-500' },
  2: { label: 'Confirm actions', color: 'text-green-500' },
  3: { label: 'Balanced', color: 'text-yellow-500' },
  4: { label: 'Mostly autonomous', color: 'text-orange-500' },
  5: { label: 'Fully autonomous', color: 'text-red-500' },
};

const EMPTY_AGENT: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  systemPrompt: '',
  tools: [],
  autonomyLevel: 3,
  status: 'draft',
};

// ─── Mock helpers (replace with real API calls when endpoint is available) ────

function mockAgents(): CustomAgent[] {
  try {
    const stored = localStorage.getItem('agent_builder_agents');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveAgentsToStorage(agents: CustomAgent[]) {
  try {
    localStorage.setItem('agent_builder_agents', JSON.stringify(agents));
  } catch {
    // ignore
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AutonomySlider({
  value,
  onChange,
}: {
  value: AutonomyLevel;
  onChange: (v: AutonomyLevel) => void;
}) {
  const info = AUTONOMY_LABELS[value];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Autonomy Level</Label>
        <span className={`text-xs font-medium ${info.color}`}>
          {value} — {info.label}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as AutonomyLevel)}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-primary"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Cautious</span>
        <span>Autonomous</span>
      </div>
    </div>
  );
}

function ToolCheckbox({
  tool,
  checked,
  onChange,
}: {
  tool: AgentTool;
  checked: boolean;
  onChange: (id: string, checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(tool.id, e.target.checked)}
        className="mt-0.5 rounded border-input accent-primary"
      />
      <div>
        <p className="text-sm font-medium leading-none">{tool.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
      </div>
    </label>
  );
}

// ─── Builder Wizard ───────────────────────────────────────────────────────────

function BuilderWizard({
  initial,
  onSave,
  onCancel,
}: {
  initial?: CustomAgent;
  onSave: (agent: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>, deployLive: boolean) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>>(
    initial
      ? {
          name: initial.name,
          description: initial.description,
          systemPrompt: initial.systemPrompt,
          tools: initial.tools,
          autonomyLevel: initial.autonomyLevel,
          status: initial.status,
        }
      : { ...EMPTY_AGENT },
  );
  const [activeTab, setActiveTab] = useState<'basics' | 'tools' | 'test'>('basics');
  const [testInput, setTestInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleTool = (id: string, checked: boolean) => {
    setForm((p) => ({
      ...p,
      tools: checked ? [...p.tools, id] : p.tools.filter((t) => t !== id),
    }));
  };

  const handleTest = async () => {
    if (!testInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', content: testInput };
    setChatHistory((p) => [...p, userMsg]);
    setTestInput('');
    setTesting(true);
    try {
      // Try real API — falls back gracefully if not available
      const res = await api.post<{ reply: string }>('/api/proxy/openclaw/agents/test', {
        systemPrompt: form.systemPrompt,
        tools: form.tools,
        message: testInput,
      });
      setChatHistory((p) => [...p, { role: 'assistant', content: res.reply }]);
    } catch {
      // Simulated response for demo purposes
      const preview = form.systemPrompt
        ? `[Test mode] I'm "${form.name || 'Unnamed Agent'}". Based on my instructions: "${form.systemPrompt.slice(0, 60)}..."`
        : `[Test mode] I'm "${form.name || 'Unnamed Agent'}" — no system prompt configured yet.`;
      setChatHistory((p) => [...p, { role: 'assistant', content: preview }]);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (deployLive: boolean) => {
    setSaving(true);
    try {
      onSave({ ...form, status: deployLive ? 'live' : 'draft' }, deployLive);
    } finally {
      setSaving(false);
    }
  };

  const isValid = form.name.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCancel}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">{initial ? 'Edit Agent' : 'Create Agent'}</h2>
          <p className="text-sm text-muted-foreground">Configure your custom AI agent</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basics">
            <Bot className="h-3.5 w-3.5 mr-1.5" />
            Basics
          </TabsTrigger>
          <TabsTrigger value="tools">
            <Wrench className="h-3.5 w-3.5 mr-1.5" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="test">
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Test
          </TabsTrigger>
        </TabsList>

        {/* ── Basics Tab ── */}
        <TabsContent value="basics" className="space-y-4 pt-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Agent Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Sales Assistant"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="What does this agent do?"
              />
            </div>

            <div className="space-y-1.5">
              <Label>System Prompt</Label>
              <Textarea
                value={form.systemPrompt}
                onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))}
                placeholder={`You are a helpful assistant. Your role is to...\n\nBe concise and professional.`}
                className="min-h-[180px] font-mono text-sm resize-y"
              />
              <p className="text-xs text-muted-foreground">
                {form.systemPrompt.length} chars — defines the agent's personality, role, and constraints.
              </p>
            </div>

            <Separator />

            <AutonomySlider
              value={form.autonomyLevel}
              onChange={(v) => setForm((p) => ({ ...p, autonomyLevel: v }))}
            />
          </div>
        </TabsContent>

        {/* ── Tools Tab ── */}
        <TabsContent value="tools" className="pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-3">
              <Sliders className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Select tools the agent can use during conversations.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {AVAILABLE_TOOLS.map((tool) => (
                <ToolCheckbox
                  key={tool.id}
                  tool={tool}
                  checked={form.tools.includes(tool.id)}
                  onChange={toggleTool}
                />
              ))}
            </div>
            {form.tools.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-1.5">Selected ({form.tools.length}):</p>
                <div className="flex flex-wrap gap-1">
                  {form.tools.map((id) => {
                    const tool = AVAILABLE_TOOLS.find((t) => t.id === id);
                    return (
                      <Badge key={id} variant="secondary" className="text-xs">
                        {tool?.label ?? id}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Test Tab ── */}
        <TabsContent value="test" className="pt-2">
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 min-h-[220px] max-h-[320px] overflow-y-auto p-3 space-y-3">
              {chatHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center pt-8">
                  Send a test message to preview how your agent responds.
                </p>
              ) : (
                chatHistory.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background border'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {testing && (
                <div className="flex justify-start">
                  <div className="bg-background border rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Send a test message..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTest();
                  }
                }}
                disabled={testing}
              />
              <Button size="icon" onClick={handleTest} disabled={testing || !testInput.trim()}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Test conversations are not saved. Responses simulate the configured system prompt.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Save Actions */}
      <Separator />
      <div className="flex flex-col sm:flex-row justify-between gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving || !isValid}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
            Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving || !isValid}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Rocket className="h-4 w-4 mr-1.5" />
            )}
            Deploy Live
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  onEdit,
  onDelete,
}: {
  agent: CustomAgent;
  onEdit: (a: CustomAgent) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate">{agent.name}</p>
                <Badge
                  variant={agent.status === 'live' ? 'default' : 'secondary'}
                  className="text-[10px] shrink-0"
                >
                  {agent.status === 'live' ? (
                    <><CheckCircle2 className="h-2.5 w-2.5 mr-1" />Live</>
                  ) : (
                    'Draft'
                  )}
                </Badge>
              </div>
              {agent.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{agent.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                <span>{agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}</span>
                <span>Autonomy {agent.autonomyLevel}/5</span>
                <span>Updated {new Date(agent.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(agent)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-500 hover:text-red-600"
              onClick={() => onDelete(agent.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function AgentBuilderContent() {
  const [agents, setAgents] = useState<CustomAgent[]>(() => mockAgents());
  const [view, setView] = useState<'list' | 'builder'>('list');
  const [editingAgent, setEditingAgent] = useState<CustomAgent | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showStatus = useCallback(
    (type: 'success' | 'error', message: string) => {
      setActionStatus({ type, message });
      setTimeout(() => setActionStatus(null), 4000);
    },
    [],
  );

  const handleSave = useCallback(
    (data: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>, deployLive: boolean) => {
      const now = new Date().toISOString();
      setAgents((prev) => {
        let updated: CustomAgent[];
        if (editingAgent) {
          updated = prev.map((a) =>
            a.id === editingAgent.id ? { ...a, ...data, updatedAt: now } : a,
          );
        } else {
          const newAgent: CustomAgent = {
            ...data,
            id: `agent_${Date.now()}`,
            createdAt: now,
            updatedAt: now,
          };
          updated = [...prev, newAgent];
        }
        saveAgentsToStorage(updated);
        return updated;
      });
      showStatus(
        'success',
        deployLive
          ? `"${data.name}" deployed live!`
          : `"${data.name}" saved as draft.`,
      );
      setView('list');
      setEditingAgent(undefined);
    },
    [editingAgent, showStatus],
  );

  const handleDelete = useCallback(
    (id: string) => {
      setAgents((prev) => {
        const updated = prev.filter((a) => a.id !== id);
        saveAgentsToStorage(updated);
        return updated;
      });
      setDeleteTarget(null);
      showStatus('success', 'Agent deleted.');
    },
    [showStatus],
  );

  if (view === 'builder') {
    return (
      <BuilderWizard
        initial={editingAgent}
        onSave={handleSave}
        onCancel={() => {
          setView('list');
          setEditingAgent(undefined);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wand2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Agent Builder</h1>
            <p className="text-muted-foreground text-sm">
              Create and deploy custom AI agents with tailored prompts and tools
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditingAgent(undefined);
            setView('builder');
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Create Agent
        </Button>
      </div>

      {/* Status feedback */}
      {actionStatus && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            actionStatus.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
          }`}
        >
          {actionStatus.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {actionStatus.message}
        </div>
      )}

      {/* Agent list */}
      {agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bot className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <CardTitle className="text-base mb-1">No agents yet</CardTitle>
            <CardDescription className="max-w-xs">
              Create your first custom agent to automate tasks with a tailored system prompt and
              tool access.
            </CardDescription>
            <Button
              className="mt-4"
              onClick={() => {
                setEditingAgent(undefined);
                setView('builder');
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {agents.length} agent{agents.length !== 1 ? 's' : ''} —{' '}
              {agents.filter((a) => a.status === 'live').length} live
            </p>
          </div>
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={(a) => {
                setEditingAgent(a);
                setView('builder');
              }}
              onDelete={(id) => setDeleteTarget(id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this agent? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Exported Page (with Pro gate) ────────────────────────────────────────────

export default function AgentBuilderPage() {
  return (
    <ProGate
      feature="agentBuilder"
      featureName="Agent Builder"
      targetTier="Pro"
      description="Build and deploy custom AI agents with tailored system prompts, tool access, and autonomy controls."
    >
      <AgentBuilderContent />
    </ProGate>
  );
}
