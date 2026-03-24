import type { CommandDef } from './types';

export const clearCommand: CommandDef = {
  name: 'clear',
  description: 'Clear the terminal screen',
  usage: '/clear',
  handler: (_args, ctx) => {
    // ANSI: erase entire display and move cursor to top-left
    ctx.terminal.write('\x1b[2J\x1b[H');
  },
};
