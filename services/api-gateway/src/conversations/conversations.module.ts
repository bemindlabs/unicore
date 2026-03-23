import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ConversationsGateway } from './conversations.gateway';
import { CannedResponsesController } from './canned-responses.controller';
import { CannedResponsesService } from './canned-responses.service';
import { MessageNormalizerService } from './normalizer/message-normalizer.service';

@Module({
  controllers: [ConversationsController, CannedResponsesController],
  providers: [ConversationsService, ConversationsGateway, CannedResponsesService, MessageNormalizerService],
  exports: [ConversationsService, CannedResponsesService, MessageNormalizerService],
})
export class ConversationsModule {}
