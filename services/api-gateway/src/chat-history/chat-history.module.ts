import { Module } from '@nestjs/common';
import { ChatHistoryController } from './chat-history.controller';
import { ChatHistoryService } from './chat-history.service';
import { ConversationIntelligenceModule } from '../conversation-intelligence/conversation-intelligence.module';

@Module({
  imports: [ConversationIntelligenceModule],
  controllers: [ChatHistoryController],
  providers: [ChatHistoryService],
  exports: [ChatHistoryService],
})
export class ChatHistoryModule {}
