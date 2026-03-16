import { Module } from '@nestjs/common';
import { ChatHistoryController } from './chat-history.controller';

@Module({
  controllers: [ChatHistoryController],
})
export class ChatHistoryModule {}
