export type { CommandContext, CommandDef } from './types';

import { helpCommand }    from './help';
import { agentsCommand }  from './agents';
import { chatCommand }    from './chat';
import { askCommand }     from './ask';
import { exitCommand }    from './exit';
import { clearCommand }   from './clear';
import { historyCommand } from './history';
import type { CommandDef, CommandContext } from './types';

const R  = '\x1b[0m';
const RD = '\x1b[91m';
const GR = '\x1b[90m';
const YL = '\x1b[33m';

const COMMANDS: CommandDef[] = [
  helpCommand,
  agentsCommand,
  chatCommand,
  askCommand,
  exitCommand,
  clearCommand,
  historyCommand,
];

const COMMAND_MAP = new Map<string, CommandDef>(
  COMMANDS.map((c) => [c.name, c]),
);

/**
 * Parse and execute a slash command typed into the terminal.
 * Returns `true` if the input was a recognized slash command, `false` otherwise.
 */
export function runCommand(input: string, ctx: CommandContext): boolean {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return false;

  const [rawName, ...args] = trimmed.slice(1).split(/\s+/);
  const name = rawName?.toLowerCase() ?? '';

  const cmd = COMMAND_MAP.get(name);
  if (!cmd) {
    ctx.terminal.writeln('');
    ctx.terminal.writeln(`${RD}Unknown command: /${name}${R}`);
    ctx.terminal.writeln(`${GR}Type ${YL}/help${GR} for a list of commands.${R}`);
    ctx.terminal.writeln('');
    return true;
  }

  cmd.handler(args, ctx);
  return true;
}

export { COMMANDS };
