import { Module } from '@nestjs/common';
import { OpenClawModule } from './openclaw.module';

@Module({
  imports: [OpenClawModule],
})
export class AppModule {}
