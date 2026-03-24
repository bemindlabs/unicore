import type { CommandDef } from './types';

const R  = '\x1b[0m';
const B  = '\x1b[1m';
const CY = '\x1b[36m';
const GR = '\x1b[90m';
const YL = '\x1b[33m';

export const historyCommand: CommandDef = {
  name: 'history',
  description: 'Show command history',
  usage: '/history',
  handler: (_args, ctx) => {
    const { history } = ctx;

    ctx.terminal.writeln('');
    ctx.terminal.writeln(`${B}${CY}Command History${R}  ${GR}(${history.length} entries)${R}`);
    ctx.terminal.writeln(`${GR}────────────────────────────${R}`);
    ctx.terminal.writeln('');

    if (history.length === 0) {
      ctx.terminal.writeln(`  ${GR}No commands recorded yet.${R}`);
      ctx.terminal.writeln('');
      return;
    }

    const start = Math.max(0, history.length - 50);
    for (let i = start; i < history.length; i++) {
      const num = String(i + 1).padStart(4, ' ');
      ctx.terminal.writeln(`  ${GR}${num}${R}  ${YL}${history[i]}${R}`);
    }

    ctx.terminal.writeln('');
  },
};
