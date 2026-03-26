import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import { ChannelsModule } from '../channels/channels.module';
import { CannedResponsesController } from './canned-responses.controller';
import { CannedResponsesService } from './canned-responses.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsGateway } from './conversations.gateway';
import { ConversationsService } from './conversations.service';
import { InboundRouterService } from './router/inbound-router.service';
import { KafkaProducerService } from './kafka/kafka-producer.service';
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
    InboundRouterService,
    KafkaProducerService,
  ],
  exports: [ConversationsService, CannedResponsesService, MessageNormalizerService, OutboundSenderService, InboundRouterService],
})
export class ConversationsModule {}
