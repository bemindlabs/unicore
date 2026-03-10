import { Module } from '@nestjs/common';
import { TemplatesModule } from './templates/templates.module';
import { ProvisioningModule } from './provisioning/provisioning.module';

@Module({
  imports: [TemplatesModule, ProvisioningModule],
})
export class AppModule {}
