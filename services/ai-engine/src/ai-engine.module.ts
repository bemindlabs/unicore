import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmModule } from './llm/llm.module';
import { PromptModule } from './prompt/prompt.module';
import { TokenTrackingModule } from './token-tracking/token-tracking.module';

/**
 * AiEngineModule — root module for the AI Engine microservice.
 *
 * Exposes:
 *  - LlmService       — complete / stream / embed with provider failover
 *  - PromptService    — template management (load, render, version)
 *  - TokenTrackingService — usage tracking and cost estimation
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TokenTrackingModule,
    LlmModule,
    PromptModule,
  ],
  exports: [LlmModule, PromptModule, TokenTrackingModule],
})
export class AiEngineModule {}
