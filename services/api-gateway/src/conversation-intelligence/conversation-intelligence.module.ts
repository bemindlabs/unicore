import { Module } from '@nestjs/common';
import { ConversationIntelligenceService } from './conversation-intelligence.service';
import { ConversationIntelligenceController } from './conversation-intelligence.controller';

@Module({
  controllers: [ConversationIntelligenceController],
  providers: [ConversationIntelligenceService],
  exports: [ConversationIntelligenceService],
})
export class ConversationIntelligenceModule {}
