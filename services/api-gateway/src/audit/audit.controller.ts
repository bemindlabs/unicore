import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('api/v1/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  getLogs(
    @Query('limit', new DefaultValuePipe(6), ParseIntPipe) limit: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('search') search?: string,
  ) {
    return this.auditService.query({ page, limit, action, resource, search });
  }
}
