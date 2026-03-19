import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [AdminController],
})
export class AdminModule {}
