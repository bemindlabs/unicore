import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { LicenseModule } from '../license/license.module';
import { AdminController } from './admin.controller';
import { SystemCommandsController } from './system-commands.controller';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

@Module({
  imports: [AuditModule, AuthModule, LicenseModule],
  controllers: [AdminController, SystemCommandsController],
  providers: [SuperAdminGuard],
})
export class AdminModule {}
