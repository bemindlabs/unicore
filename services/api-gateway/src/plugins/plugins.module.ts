import { Module } from '@nestjs/common';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PluginsController],
  providers: [PluginsService],
  exports: [PluginsService],
})
export class PluginsModule {}
