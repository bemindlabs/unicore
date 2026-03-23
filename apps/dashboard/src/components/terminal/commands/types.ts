import type { Terminal } from '@xterm/xterm';
import type { BackofficeAgent } from '@/lib/backoffice/types';

export interface CommandContext {
  /** xterm.js Terminal instance — use writeln() to print output. */
  terminal: Terminal;
  /** Agent this terminal is attached to. */
  agent: BackofficeAgent;
  /** All known agents (9 total). */
  agents: BackofficeAgent[];
  /** Ordered command history (most recent last). */
  history: readonly string[];
  /** Currently active chat agent id, or null. */
  activeChat: string | null;
  /** Send a question through the Router Agent pipeline. */
  sendAsk: (question: string) => void;
  /** Switch the active chat to the given agent id. */
  onChatStart: (agentId: string) => void;
  /** Close the terminal panel. */
  onClose: () => void;
}

export interface CommandDef {
  name: string;
  description: string;
  usage: string;
  handler: (args: string[], ctx: CommandContext) => void;
}
