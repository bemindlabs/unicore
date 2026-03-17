import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { RagProxyController } from './rag-proxy.controller';
import { ProxyService } from './proxy.service';

@Module({
  controllers: [RagProxyController, ProxyController],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
