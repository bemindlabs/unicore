import { Module } from '@nestjs/common';
import { OpenClawModule } from './openclaw.module';
import { TerminalModule } from './terminal/terminal.module';

@Module({
  imports: [OpenClawModule, TerminalModule],
})
export class AppModule {}
