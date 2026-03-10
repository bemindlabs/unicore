import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [KafkaModule],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
