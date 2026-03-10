import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { OrdersService } from './orders.service';

@Module({
  imports: [KafkaModule],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
