import { Controller, Post, Body, Logger, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const MAX_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_SIZE = 64 * 1024; // 64 KB
const MAX_COMMAND_LENGTH = 2_000;

/** Shell metacharacters and patterns that enable command injection */
const DANGEROUS_PATTERNS: readonly RegExp[] = [
  /;/,          // command chaining
  /&&/,         // logical AND chaining
  /\|\|/,       // logical OR chaining
  /\|/,         // pipe
  /\$\(/,       // command substitution
  /`/,          // backtick command substitution
  />/,          // output redirection
  /</,          // input redirection
  /\n/,         // newline injection
  /\r/,         // carriage return injection
];

/** Known safe command prefixes (extend as needed) */
const ALLOWED_PREFIXES: readonly string[] = [
  'ls', 'cat', 'head', 'tail', 'echo', 'pwd', 'whoami', 'date',
  'node', 'npm', 'npx', 'pnpm', 'yarn', 'tsx', 'tsc',
  'git', 'docker', 'prisma',
  'curl', 'wget', 'ping', 'dig', 'nslookup',
  'ps', 'top', 'df', 'du', 'free', 'uptime', 'uname', 'env', 'printenv',
  'wc', 'sort', 'uniq', 'grep', 'find', 'which', 'file', 'stat',
  'mkdir', 'cp', 'mv', 'rm', 'touch', 'chmod',
  'tmux', 'kill', 'pkill',
];

@Controller('terminal')
export class TerminalController {
  private readonly logger = new Logger(TerminalController.name);

  /**
   * Validate that a command is safe to execute.
   * Blocks dangerous shell metacharacters and enforces an allowlist of command prefixes.
   */
  private validateCommand(command: string): void {
    if (command.length > MAX_COMMAND_LENGTH) {
      throw new BadRequestException(`Command exceeds maximum length of ${MAX_COMMAND_LENGTH} characters`);
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        throw new BadRequestException('Command contains disallowed shell metacharacters');
      }
    }

    const firstToken = command.trim().split(/\s+/)[0];
    // Strip any path prefix to get the binary name (e.g. /usr/bin/node → node)
    const binaryName = firstToken.split('/').pop() ?? firstToken;
    if (!ALLOWED_PREFIXES.includes(binaryName)) {
      throw new BadRequestException(`Command '${binaryName}' is not in the allowed command list`);
    }
  }

  /**
   * POST /terminal/exec
   * Execute a shell command and return stdout/stderr.
   */
  @Post('exec')
  @HttpCode(HttpStatus.OK)
  async execute(@Body() body: { command: string; cwd?: string; timeout?: number }) {
    const { command, cwd, timeout } = body;

    if (!command?.trim()) {
      return { stdout: '', stderr: 'No command provided', exitCode: 1 };
    }

    this.validateCommand(command);

    const timeoutMs = Math.min(timeout ?? 10_000, MAX_TIMEOUT_MS);

    this.logger.log(`Executing: ${command.slice(0, 100)}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd ?? '/app',
        timeout: timeoutMs,
        maxBuffer: MAX_OUTPUT_SIZE,
        env: { ...process.env, TERM: 'dumb', HOME: '/tmp' },
      });

      return {
        stdout: stdout.slice(0, MAX_OUTPUT_SIZE),
        stderr: stderr.slice(0, MAX_OUTPUT_SIZE),
        exitCode: 0,
      };
    } catch (err: any) {
      return {
        stdout: (err.stdout ?? '').slice(0, MAX_OUTPUT_SIZE),
        stderr: (err.stderr ?? err.message ?? 'Command failed').slice(0, MAX_OUTPUT_SIZE),
        exitCode: err.code ?? 1,
      };
    }
  }
}
