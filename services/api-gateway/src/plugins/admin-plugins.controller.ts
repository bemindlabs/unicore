import { Controller, Get, Post, Param, Body, Logger } from '@nestjs/common';
import { PluginsService } from './plugins.service';
import { RejectPluginDto } from './dto/reject-plugin.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Roles('OWNER')
@Controller('api/v1/admin/plugins')
export class AdminPluginsController {
  private readonly logger = new Logger(AdminPluginsController.name);

  constructor(private readonly pluginsService: PluginsService) {}

  @Get('pending')
  getPending() {
    return this.pluginsService.getPending();
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @CurrentUser() currentUser: any) {
    this.logger.log(`Plugin ${id} approved by admin ${currentUser.id}`);
    return this.pluginsService.approve(id, currentUser.id);
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectPluginDto,
    @CurrentUser() currentUser: any,
  ) {
    this.logger.log(`Plugin ${id} rejected by admin ${currentUser.id}: ${dto.reason}`);
    return this.pluginsService.reject(id, currentUser.id, dto.reason);
  }
}
