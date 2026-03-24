import type { CommandDef } from './types';

const R  = '\x1b[0m';
const B  = '\x1b[1m';
const CY = '\x1b[36m';
const GR = '\x1b[90m';
const YL = '\x1b[33m';

export const helpCommand: CommandDef = {
  name: 'help',
  description: 'Show all available commands',
  usage: '/help',
  handler: (_args, ctx) => {
    const rows: [string, string][] = [
      ['help',               'Show this help message'],
      ['agents',             'List all 9 agents with live status'],
      ['chat <agent>',       'Start direct session (e.g. /chat finance)'],
      ['ask <question>',     'Route question through Router Agent'],
      ['history',            'Show command history'],
      ['clear',              'Clear the terminal screen'],
      ['exit',               'Close this terminal panel'],
    ];

    ctx.terminal.writeln('');
    ctx.terminal.writeln(`${B}${CY}UniCore Terminal — Agent Commands${R}`);
    ctx.terminal.writeln(`${GR}────────────────────────────────────${R}`);
    ctx.terminal.writeln('');
    for (const [cmd, desc] of rows) {
      const padded = `/${cmd}`.padEnd(24);
      ctx.terminal.writeln(`  ${YL}${padded}${R}${desc}`);
    }
    ctx.terminal.writeln('');
  },
};
