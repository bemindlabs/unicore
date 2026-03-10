import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { ProviderFactoryService } from './factory/provider-factory.service';
import { TokenTrackingModule } from '../token-tracking/token-tracking.module';

@Module({
  imports: [ConfigModule, TokenTrackingModule],
  controllers: [LlmController],
  providers: [ProviderFactoryService, LlmService],
  exports: [LlmService, ProviderFactoryService],
})
export class LlmModule {}
