import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { InventoryService } from './inventory.service';

@Module({
  imports: [KafkaModule],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
