import { Module } from '@nestjs/common';
import { PluginsController } from './plugins.controller';
import { AdminPluginsController } from './admin-plugins.controller';
import { PluginsService } from './plugins.service';
import { PluginArtifactService } from './plugin-artifact.service';
import { PluginRuntimeService } from './plugin-runtime.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PluginsController, AdminPluginsController],
  providers: [PluginsService, PluginArtifactService, PluginRuntimeService],
  exports: [PluginsService, PluginRuntimeService],
})
export class PluginsModule {}
