import { Module } from '@nestjs/common';
import { BootstrapProxyController } from './bootstrap-proxy.controller';
import { ProxyController } from './proxy.controller';
import { RagProxyController } from './rag-proxy.controller';
import { ProxyService } from './proxy.service';

@Module({
  controllers: [BootstrapProxyController, RagProxyController, ProxyController],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
