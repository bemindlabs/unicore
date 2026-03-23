import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import { ChannelsModule } from '../channels/channels.module';
import { CannedResponsesController } from './canned-responses.controller';
import { CannedResponsesService } from './canned-responses.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsGateway } from './conversations.gateway';
import { ConversationsService } from './conversations.service';
import { MessageNormalizerService } from './normalizer/message-normalizer.service';
import { OutboundSenderService } from './sender/outbound-sender.service';

@Module({
  imports: [ConfigModule, ChannelsModule, AuditModule],
  controllers: [ConversationsController, CannedResponsesController],
  providers: [
    ConversationsService,
    ConversationsGateway,
    CannedResponsesService,
    MessageNormalizerService,
    OutboundSenderService,
  ],
  exports: [ConversationsService, CannedResponsesService, MessageNormalizerService, OutboundSenderService],
})
export class ConversationsModule {}
