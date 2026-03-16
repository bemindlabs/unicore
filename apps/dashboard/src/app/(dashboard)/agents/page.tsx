'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bot, ExternalLink, Settings } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@unicore/ui';
import { getAgents } from '@/lib/backoffice/store';
import type { BackofficeAgent } from '@/lib/backoffice/types';
import { useLicense } from '@/hooks/use-license';

export default function AgentsPage() {
  const { maxAgents, isPro } = useLicense();
  const [agents, setAgents] = useState<BackofficeAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgents()
      .then(({ agents: data }) => setAgents(data))
      .finally(() => setLoading(false));
  }, []);

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
            <p className="text-muted-foreground">Manage and monitor your AI agents</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!loading && (
            <span className={`text-sm font-medium ${agents.length >= maxAgents ? 'text-amber-600' : 'text-muted-foreground'}`}>
              Agents: {agents.length}/{maxAgents}
              {!isPro && agents.length >= maxAgents && (
                <a href="/settings/license" className="text-amber-600 underline ml-1 text-xs">(upgrade for more)</a>
              )}
            </span>
          )}
          <Link
            href="/backoffice"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
            Open Backoffice
          </Link>
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Working</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-2xl font-bold">{working}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Idle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-2xl font-bold">{idle}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Offline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-2xl font-bold">{offline}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agent list */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">Loading agents...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">All Agents ({agents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full" style={{ background: agent.color }} />
                    <div>
                      <span className="text-sm font-medium">{agent.name}</span>
                      {agent.role && <span className="text-xs text-muted-foreground ml-2">{agent.role}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={agent.status === 'working' ? 'default' : agent.status === 'idle' ? 'secondary' : 'outline'}>
                      {agent.status}
                    </Badge>
                    {agent.activity && <span className="text-xs text-muted-foreground max-w-48 truncate">{agent.activity}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backoffice link */}
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
