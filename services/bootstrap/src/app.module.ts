import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TemplatesModule } from './templates/templates.module';
import { ProvisioningModule } from './provisioning/provisioning.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TemplatesModule,
    ProvisioningModule,
  ],
})
export class AppModule {}
