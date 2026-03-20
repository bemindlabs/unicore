import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [TasksController],
})
export class TasksModule {}
