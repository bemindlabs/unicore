import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PluginsService } from './plugins.service';
import { BrowsePluginsDto } from './dto/browse-plugins.dto';
import { InstallPluginDto } from './dto/install-plugin.dto';
import { ConfigurePluginDto } from './dto/configure-plugin.dto';

@Controller('api/v1/plugins')
export class PluginsController {
  constructor(private readonly pluginsService: PluginsService) {}

  @Get()
  browse(@Query() query: BrowsePluginsDto) {
    return this.pluginsService.browse(query);
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.pluginsService.findBySlug(slug);
  }

  @Post()
  @Roles('OWNER')
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.pluginsService.create(body);
  }

  @Post(':id/install')
  install(
    @Param('id') id: string,
    @Body() dto: InstallPluginDto,
    @CurrentUser() user: any,
  ) {
    return this.pluginsService.install(id, dto, user.id, user.email);
  }

  @Delete(':id/uninstall')
  @HttpCode(HttpStatus.NO_CONTENT)
  async uninstall(
    @Param('id') id: string,
    @Query('instanceId') instanceId: string = 'default',
    @CurrentUser() user: any,
  ) {
    await this.pluginsService.uninstall(id, instanceId, user.id, user.email);
  }

  @Post(':id/enable')
  enable(
    @Param('id') id: string,
    @Query('instanceId') instanceId: string = 'default',
    @CurrentUser() user: any,
  ) {
    return this.pluginsService.setEnabled(id, true, instanceId, user.id, user.email);
  }

  @Post(':id/disable')
  disable(
    @Param('id') id: string,
    @Query('instanceId') instanceId: string = 'default',
    @CurrentUser() user: any,
  ) {
    return this.pluginsService.setEnabled(id, false, instanceId, user.id, user.email);
  }

  @Put(':id/configure')
  configure(
    @Param('id') id: string,
    @Body() dto: ConfigurePluginDto,
    @Query('instanceId') instanceId: string = 'default',
    @CurrentUser() user: any,
  ) {
    return this.pluginsService.configure(id, dto, instanceId, user.id, user.email);
  }
}
