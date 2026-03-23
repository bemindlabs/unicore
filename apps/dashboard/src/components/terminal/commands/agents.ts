import type { CommandDef } from './types';
import type { AgentStatus } from '@/lib/backoffice/types';

const R  = '\x1b[0m';
const B  = '\x1b[1m';
const CY = '\x1b[36m';
const GR = '\x1b[90m';
const YL = '\x1b[33m';
const GN = '\x1b[92m';  // bright green
const RD = '\x1b[91m';  // bright red

function statusColor(s: AgentStatus): string {
  if (s === 'working') return GN;
  if (s === 'idle')    return YL;
  return GR; // offline
}

function statusLabel(s: AgentStatus): string {
  if (s === 'working') return '● WORKING';
  if (s === 'idle')    return '○ IDLE   ';
  return '✕ OFFLINE';
}

export const agentsCommand: CommandDef = {
  name: 'agents',
  description: 'List all 9 agents with status',
  usage: '/agents',
  handler: (_args, ctx) => {
    const { agents } = ctx;

    const working = agents.filter((a) => a.status === 'working').length;
    const idle    = agents.filter((a) => a.status === 'idle').length;
    const offline = agents.filter((a) => a.status === 'offline').length;

    ctx.terminal.writeln('');
    ctx.terminal.writeln(`${B}${CY}OpenClaw Agent Registry${R}  ${GR}(${agents.length} total)${R}`);
    ctx.terminal.writeln(`${GR}──────────────────────────────────────────────${R}`);
    ctx.terminal.writeln('');

    for (const agent of agents) {
      const sc    = statusColor(agent.status);
      const label = statusLabel(agent.status);
      const id    = agent.id.padEnd(10);
      const role  = agent.role;
      ctx.terminal.writeln(`  ${sc}${label}${R}  ${B}${id}${R}  ${GR}${role}${R}`);
      if (agent.activity) {
        ctx.terminal.writeln(`             ${GR}↳ ${agent.activity}${R}`);
      }
    }

    ctx.terminal.writeln('');
    ctx.terminal.writeln(
      `  Summary: ${GN}${working} working${R}  ${YL}${idle} idle${R}  ${RD}${offline} offline${R}`,
    );
    ctx.terminal.writeln('');
    ctx.terminal.writeln(`${GR}  Use ${YL}/chat <agent-id>${GR} to start a direct session.${R}`);
    ctx.terminal.writeln('');
  },
};
