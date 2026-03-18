import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const MAX_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_SIZE = 64 * 1024; // 64 KB

@Controller('terminal')
export class TerminalController {
  private readonly logger = new Logger(TerminalController.name);

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
