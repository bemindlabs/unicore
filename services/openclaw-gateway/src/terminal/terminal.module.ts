import { Module, forwardRef } from '@nestjs/common';
import { TerminalController } from './terminal.controller';
import { TmuxController } from './tmux.controller';
import { TmuxService } from './tmux.service';
import { TmuxManager } from './tmux-manager';
import { OpenClawModule } from '../openclaw.module';

@Module({
  imports: [forwardRef(() => OpenClawModule)],
  controllers: [TerminalController, TmuxController],
  providers: [TmuxService, TmuxManager],
  exports: [TmuxService, TmuxManager],
})
export class TerminalModule {}
