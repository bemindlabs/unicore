import { Module } from '@nestjs/common';
import { ConversationsAnalyticsController } from './conversations-analytics.controller';
import { ConversationsAnalyticsService } from './conversations-analytics.service';

@Module({
  controllers: [ConversationsAnalyticsController],
  providers: [ConversationsAnalyticsService],
})
export class ConversationsAnalyticsModule {}
