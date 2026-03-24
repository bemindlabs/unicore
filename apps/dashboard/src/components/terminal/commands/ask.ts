import type { CommandDef } from './types';

const R  = '\x1b[0m';
const B  = '\x1b[1m';
const CY = '\x1b[36m';
const GR = '\x1b[90m';
const YL = '\x1b[33m';
const RD = '\x1b[91m';

export const askCommand: CommandDef = {
  name: 'ask',
  description: 'Route a question through the Router Agent',
  usage: '/ask <question>',
  handler: (args, ctx) => {
    const question = args.join(' ').trim();

    if (!question) {
      ctx.terminal.writeln('');
      ctx.terminal.writeln(`${RD}Usage: /ask <question>${R}`);
      ctx.terminal.writeln(`${GR}Example: /ask What is our monthly revenue?${R}`);
      ctx.terminal.writeln('');
      return;
    }

    ctx.terminal.writeln('');
    ctx.terminal.writeln(`${B}${CY}You${R}  ${GR}→ Router Agent${R}`);
    ctx.terminal.writeln(`${YL}${question}${R}`);
    ctx.terminal.writeln('');
    ctx.terminal.writeln(`${GR}⟳ Routing to best agent…${R}`);
    ctx.terminal.writeln('');

    ctx.sendAsk(question);
  },
};
