'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Bot, ExternalLink, Settings, MessageCircle, Terminal, Send,
  ChevronDown, ChevronRight, Circle, X, Loader2,
  Shield, Zap, TrendingUp, Mail, Search, Wrench, BarChart3, Database,
  Plus, Crown, Lock,
} from 'lucide-react';
import { Badge, Card, CardContent, Button, Input } from '@bemindlabs/unicore-ui';
import { getAgents } from '@/lib/agents/store';
import type { BackofficeAgent } from '@/lib/agents/types';
import { useLicense } from '@/hooks/use-license';
import { useChatWebSocket, type ChatMessage } from '@/hooks/use-chat-ws';
import { api } from '@/lib/api';

// ── Icons ─────────────────────────────────────────────────────────────────

const AGENT_ICONS: Record<string, typeof Bot> = {
  router: Zap, comms: Mail, finance: BarChart3, growth: TrendingUp,
  ops: Wrench, research: Search, sentinel: Shield, builder: Wrench, erp: Database,
};

// ── Inline Agent Chat ─────────────────────────────────────────────────────

function AgentChat({ agent, onClose }: { agent: BackofficeAgent; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev.slice(-100), msg]);
  }, []);

  const { connected, send } = useChatWebSocket(`chat-agent-${agent.id}`, handleMessage);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    send(input.trim(), 'You', 'human-user', 'human');
    setInput('');
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageCircle className="h-3.5 w-3.5" />
          Chat with {agent.name}
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'}`} />
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div ref={scrollRef} className="h-48 overflow-y-auto px-3 py-2 space-y-1.5 text-sm">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-xs py-8">Send a message to start chatting with {agent.name}</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.authorType === 'human' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-xs ${
              msg.authorType === 'human' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t px-3 py-2 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={connected ? `Message ${agent.name}...` : 'Connecting...'}
          disabled={!connected}
          className="h-8 text-xs"
        />
        <Button size="sm" className="h-8 px-3" onClick={handleSend} disabled={!connected || !input.trim()}>
          <Send className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Quick Command ─────────────────────────────────────────────────────────

function QuickCommand({ agent: _agent }: { agent: BackofficeAgent }) {
  const [cmd, setCmd] = useState('');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    if (!cmd.trim()) return;
    setRunning(true);
    setOutput('');
    try {
      const result = await api.post<{ stdout: string; stderr: string; exitCode: number }>(
        '/api/proxy/openclaw/terminal/exec',
        { command: cmd, timeout: 10000 },
      );
      setOutput(result.stdout || result.stderr || `exit: ${result.exitCode}`);
    } catch (err) {
      setOutput(err instanceof Error ? err.message : 'Failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRun()}
          placeholder="Run command..."
          className="h-8 text-xs font-mono"
          disabled={running}
        />
        <Button size="sm" className="h-8 px-3" onClick={handleRun} disabled={running || !cmd.trim()}>
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Terminal className="h-3 w-3" />}
        </Button>
      </div>
      {output && (
        <pre className="bg-muted rounded p-2 text-[10px] font-mono max-h-32 overflow-auto whitespace-pre-wrap">{output}</pre>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const { maxAgents, isPro } = useLicense();
  const [agents, setAgents] = useState<BackofficeAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [agentDetails, setAgentDetails] = useState<Record<string, any>>({});

  useEffect(() => {
    getAgents()
      .then(({ agents: data }) => setAgents(data))
      .finally(() => setLoading(false));
  }, []);

  // Fetch OpenClaw details for expanded agent
  useEffect(() => {
    if (!expandedId || agentDetails[expandedId]) return;
    api.get<any>(`/api/proxy/openclaw/agents/${expandedId}`)
      .then((data) => setAgentDetails((prev) => ({ ...prev, [expandedId]: data })))
      .catch(() => {});
  }, [expandedId, agentDetails]);

  const working = agents.filter((a) => a.status === 'working').length;
  const idle = agents.filter((a) => a.status === 'idle').length;
  const offline = agents.filter((a) => a.status === 'offline').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Agents</h1>
            <p className="text-muted-foreground">Chat, command, and monitor your AI agents</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {agents.length} agents
            </span>
          )}
          {/* Create Custom Agent — Pro only */}
          <button
            disabled={!isPro}
            title={!isPro ? 'Available in Pro' : 'Create a custom agent'}
            className={`flex items-center gap-1.5 text-xs border rounded-md px-2.5 py-1.5 transition-colors ${
              isPro
                ? 'text-foreground hover:bg-muted/50'
                : 'text-muted-foreground opacity-50 cursor-not-allowed'
            }`}
            onClick={() => {
              if (!isPro) return;
              // Agent builder is a Pro feature
            }}
          >
            {isPro ? <Plus className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {isPro ? 'New Agent' : 'New Agent (Pro)'}
          </button>
          <Link
            href="/virtual-office"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border rounded-md px-2.5 py-1.5"
          >
            <Settings className="h-3.5 w-3.5" /> Virtual Office
          </Link>
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid gap-3 grid-cols-3">
          {[
            { label: 'Working', count: working, color: 'bg-green-500' },
            { label: 'Idle', count: idle, color: 'bg-yellow-400' },
            { label: 'Offline', count: offline, color: 'bg-red-500' },
          ].map(({ label, count, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-2xl font-bold">{count}</span>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Agent list */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">Loading agents...</div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => {
            const isExpanded = expandedId === agent.id;
            const isChatting = chatAgentId === agent.id;
            const Icon = AGENT_ICONS[agent.id] ?? Bot;
            const details = agentDetails[agent.id];

            return (
              <Card key={agent.id} className="overflow-hidden">
                {/* Agent row */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : agent.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${agent.color}20` }}>
                      <Icon className="h-4 w-4" style={{ color: agent.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{agent.name}</span>
                        {agent.role && <span className="text-[10px] text-muted-foreground">{agent.role}</span>}
                      </div>
                      {agent.activity && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{agent.activity}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Action buttons */}
                    <Button
                      variant="ghost" size="sm" className="h-7 px-2 text-xs"
                      onClick={(e) => { e.stopPropagation(); setChatAgentId(isChatting ? null : agent.id); }}
                    >
                      <MessageCircle className="h-3 w-3 mr-1" />
                      Chat
                    </Button>
                    <Badge variant={agent.status === 'working' ? 'default' : agent.status === 'idle' ? 'secondary' : 'outline'}>
                      {agent.status}
                    </Badge>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Chat panel (inline) */}
                {isChatting && (
                  <div className="px-4 pb-4">
                    <AgentChat agent={agent} onClose={() => setChatAgentId(null)} />
                  </div>
                )}

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t bg-muted/20 px-4 py-3 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block">Type</span>
                        <span className="font-mono">{details?.type ?? agent.id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Version</span>
                        <span className="font-mono">{details?.version ?? '1.0.0'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">State</span>
                        <span className="flex items-center gap-1">
                          <Circle className={`h-1.5 w-1.5 fill-current ${
                            details?.state === 'running' ? 'text-green-500' :
                            details?.state === 'idle' ? 'text-yellow-500' : 'text-red-500'
                          }`} />
                          {details?.state ?? agent.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Heartbeat</span>
                        <span>{details?.lastHeartbeatAt ? new Date(details.lastHeartbeatAt).toLocaleTimeString() : '—'}</span>
                      </div>
                    </div>

                    {/* Capabilities */}
                    {details?.capabilities?.length > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground">Capabilities</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {details.capabilities.map((cap: any) => (
                            <span key={typeof cap === 'string' ? cap : cap.name} className="inline-block bg-muted px-2 py-0.5 rounded text-[10px] font-mono">
                              {typeof cap === 'string' ? cap : cap.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick command */}
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Quick Command</span>
                      <QuickCommand agent={agent} />
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Backoffice link */}
      <Link
        href="/backoffice"
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <Bot className="h-4 w-4" />
        Open Backoffice — Full Agent Management
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>

      {/* Terminal slide-in */}
      {terminalAgent && (
        <AgentTerminal
          agent={terminalAgent}
          open={!!terminalAgent}
          onClose={() => setTerminalAgent(null)}
        />
      )}
    </div>
  );
}
