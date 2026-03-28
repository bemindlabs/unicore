import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TokenTrackingService } from './token-tracking.service';
import { TokenTrackingController } from './token-tracking.controller';

@Module({
  imports: [ConfigModule],
  controllers: [TokenTrackingController],
  providers: [TokenTrackingService],
  exports: [TokenTrackingService],
})
export class TokenTrackingModule {}
