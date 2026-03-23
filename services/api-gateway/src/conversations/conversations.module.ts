import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ConversationsGateway } from './conversations.gateway';
import { CannedResponsesController } from './canned-responses.controller';
import { CannedResponsesService } from './canned-responses.service';

@Module({
  controllers: [ConversationsController, CannedResponsesController],
  providers: [ConversationsService, ConversationsGateway, CannedResponsesService],
  exports: [ConversationsService, CannedResponsesService],
})
export class ConversationsModule {}
