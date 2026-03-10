import { Module } from '@nestjs/common';
import { PromptService } from './service/prompt.service';
import { PromptController } from './prompt.controller';

@Module({
  controllers: [PromptController],
  providers: [PromptService],
  exports: [PromptService],
})
export class PromptModule {}
