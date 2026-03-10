import { Module } from '@nestjs/common';
import { ProvisioningController } from './provisioning.controller';
import { ProvisioningService } from './provisioning.service';
import { TemplatesModule } from '../templates/templates.module';
import { ConfigGeneratorModule } from '../config-generator/config-generator.module';

@Module({
  imports: [TemplatesModule, ConfigGeneratorModule],
  controllers: [ProvisioningController],
  providers: [ProvisioningService],
})
export class ProvisioningModule {}
