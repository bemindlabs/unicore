import type { CommandDef } from './types';

const R  = '\x1b[0m';
const GR = '\x1b[90m';
const YL = '\x1b[33m';

export const exitCommand: CommandDef = {
  name: 'exit',
  description: 'Close the current agent session',
  usage: '/exit',
  handler: (_args, ctx) => {
    if (ctx.activeChat) {
      ctx.terminal.writeln('');
      ctx.terminal.writeln(`${GR}Ending session with ${YL}${ctx.activeChat}${GR}…${R}`);
      ctx.terminal.writeln('');
      ctx.onChatStart('');
      return;
    }

    ctx.terminal.writeln('');
    ctx.terminal.writeln(`${GR}Closing terminal…${R}`);
    ctx.terminal.writeln('');
    setTimeout(() => ctx.onClose(), 300);
  },
};
