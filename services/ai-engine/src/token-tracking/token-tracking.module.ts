import { Module } from '@nestjs/common';
import { TokenTrackingService } from './token-tracking.service';
import { TokenTrackingController } from './token-tracking.controller';

@Module({
  controllers: [TokenTrackingController],
  providers: [TokenTrackingService],
  exports: [TokenTrackingService],
})
export class TokenTrackingModule {}
