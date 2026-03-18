import { Module } from '@nestjs/common';
import { TerminalController } from './terminal.controller';
import { TmuxController } from './tmux.controller';
import { TmuxService } from './tmux.service';

@Module({
  controllers: [TerminalController, TmuxController],
  providers: [TmuxService],
})
export class TerminalModule {}
