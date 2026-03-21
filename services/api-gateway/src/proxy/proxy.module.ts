import { Module } from '@nestjs/common';
import { LicenseModule } from '../license/license.module';
import { AiProxyController } from './ai-proxy.controller';
import { BootstrapProxyController } from './bootstrap-proxy.controller';
import { DlcProxyController } from './dlc-proxy.controller';
import { ErpProxyController } from './erp-proxy.controller';
import { ProxyController } from './proxy.controller';
import { RagProxyController } from './rag-proxy.controller';
import { ProxyService } from './proxy.service';

@Module({
  imports: [LicenseModule],
  controllers: [AiProxyController, BootstrapProxyController, DlcProxyController, ErpProxyController, RagProxyController, ProxyController],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
