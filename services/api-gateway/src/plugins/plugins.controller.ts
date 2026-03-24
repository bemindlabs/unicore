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
  Logger,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PluginsService } from './plugins.service';
import { BrowsePluginsDto } from './dto/browse-plugins.dto';
import { InstallPluginDto } from './dto/install-plugin.dto';
import { ConfigurePluginDto } from './dto/configure-plugin.dto';
import { SubmitPluginDto } from './dto/submit-plugin.dto';

@Controller('api/v1/plugins')
export class PluginsController {
  private readonly logger = new Logger(PluginsController.name);

  constructor(private readonly pluginsService: PluginsService) {}

  @Post('submit')
  async submit(@Body() dto: SubmitPluginDto, @CurrentUser() currentUser: any) {
    this.logger.log(`Plugin submit by user ${currentUser.id}: ${dto.slug}`);
    return this.pluginsService.submit(dto, currentUser.id);
  }

  @Get('my-plugins')
  async myPlugins(@CurrentUser() currentUser: any) {
    return this.pluginsService.getMyPlugins(currentUser.id);
  }

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
  create(@Body() body: any, @CurrentUser() _user: any) {
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
