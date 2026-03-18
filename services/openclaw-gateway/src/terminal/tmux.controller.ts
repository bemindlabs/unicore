import {
  Controller, Post, Get, Delete, Body, Param, HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { TmuxService } from './tmux.service';

@Controller('terminal/tmux')
export class TmuxController {
  private readonly logger = new Logger(TmuxController.name);

  constructor(private readonly tmux: TmuxService) {}

  /** GET /terminal/tmux/sessions */
  @Get('sessions')
  async listSessions() {
    return this.tmux.listSessions();
  }

  /** POST /terminal/tmux/session */
  @Post('session')
  @HttpCode(HttpStatus.OK)
  async createSession(@Body() body: { name: string }) {
    const { name } = body;
    if (!name?.trim()) return { ok: false, error: 'Session name required' };
    this.logger.log(`Create session: ${name}`);
    return this.tmux.createSession(name.trim());
  }

  /** GET /terminal/tmux/session/:name */
  @Get('session/:name')
  async getSession(@Param('name') name: string) {
    const session = await this.tmux.getSession(name);
    if (!session) return { ok: false, error: `Session '${name}' not found` };
    return { ok: true, ...session };
  }

  /** POST /terminal/tmux/session/:name/exec */
  @Post('session/:name/exec')
  @HttpCode(HttpStatus.OK)
  async execInSession(
    @Param('name') name: string,
    @Body() body: { command: string; pane?: number },
  ) {
    const { command, pane } = body;
    if (!command?.trim()) return { ok: false, error: 'Command required' };
    this.logger.log(`Exec in ${name}: ${command.slice(0, 80)}`);
    const result = await this.tmux.execInSession(name, command.trim(), pane ?? 0);
    if (!result.ok) return result;
    // Small delay to capture initial output
    await new Promise((r) => setTimeout(r, 300));
    const output = await this.tmux.captureOutput(name, pane ?? 0);
    return { ok: true, output };
  }

  /** DELETE /terminal/tmux/session/:name */
  @Delete('session/:name')
  async killSession(@Param('name') name: string) {
    this.logger.log(`Kill session: ${name}`);
    return this.tmux.killSession(name);
  }

  /** POST /terminal/tmux/session/:name/split */
  @Post('session/:name/split')
  @HttpCode(HttpStatus.OK)
  async splitPane(
    @Param('name') name: string,
    @Body() body: { direction?: 'h' | 'v' },
  ) {
    return this.tmux.splitPane(name, body.direction ?? 'h');
  }

  /** POST /terminal/tmux/session/:name/window */
  @Post('session/:name/window')
  @HttpCode(HttpStatus.OK)
  async newWindow(
    @Param('name') name: string,
    @Body() body: { name?: string },
  ) {
    return this.tmux.newWindow(name, body.name);
  }
}
