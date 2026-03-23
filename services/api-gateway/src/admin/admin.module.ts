import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { LicenseModule } from '../license/license.module';
import { AdminController } from './admin.controller';
import { SystemCommandsController } from './system-commands.controller';

@Module({
  imports: [AuditModule, AuthModule, LicenseModule],
  controllers: [AdminController, SystemCommandsController],
})
export class AdminModule {}
