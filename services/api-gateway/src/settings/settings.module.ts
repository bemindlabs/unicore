import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { LicenseModule } from '../license/license.module';

@Module({
  imports: [LicenseModule],
  controllers: [SettingsController],
})
export class SettingsModule {}
