import type { CommandDef } from './types';

const R  = '\x1b[0m';
const B  = '\x1b[1m';
const CY = '\x1b[36m';
const GR = '\x1b[90m';
const YL = '\x1b[33m';
const RD = '\x1b[91m';

export const chatCommand: CommandDef = {
  name: 'chat',
  description: 'Start a direct session with an agent',
  usage: '/chat <agent-id>',
  handler: (args, ctx) => {
    const target = args[0]?.toLowerCase().trim();

    if (!target) {
      ctx.terminal.writeln('');
      ctx.terminal.writeln(`${RD}Usage: /chat <agent-id>${R}`);
      ctx.terminal.writeln(`${GR}Example: /chat finance${R}`);
      ctx.terminal.writeln('');
      return;
    }

    const agent = ctx.agents.find(
      (a) => a.id.toLowerCase() === target || a.name.toLowerCase() === target,
    );

    if (!agent) {
      ctx.terminal.writeln('');
      ctx.terminal.writeln(`${RD}Agent "${target}" not found.${R}`);
      ctx.terminal.writeln(`${GR}Run ${YL}/agents${GR} to see available agents.${R}`);
      ctx.terminal.writeln('');
      return;
    }

    if (agent.status === 'offline') {
      ctx.terminal.writeln('');
      ctx.terminal.writeln(`${RD}Agent ${B}${agent.name}${R}${RD} is currently offline.${R}`);
      ctx.terminal.writeln(`${GR}Try ${YL}/agents${GR} to check agent status.${R}`);
      ctx.terminal.writeln('');
      return;
    }

    ctx.onChatStart(agent.id);

    ctx.terminal.writeln('');
    ctx.terminal.writeln(`${B}${CY}Connected to ${agent.name}${R}`);
    ctx.terminal.writeln(`${GR}Role: ${agent.role}${R}`);
    ctx.terminal.writeln(`${GR}Status: ${agent.status}${R}`);
    ctx.terminal.writeln('');
    ctx.terminal.writeln(`${GR}Type your message and press Enter. Use ${YL}/exit${GR} to end session.${R}`);
    ctx.terminal.writeln('');
  },
};
