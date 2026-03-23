import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BrowsePluginsDto } from './dto/browse-plugins.dto';
import { InstallPluginDto } from './dto/install-plugin.dto';
import { ConfigurePluginDto } from './dto/configure-plugin.dto';

@Injectable()
export class PluginsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async browse(query: BrowsePluginsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { author: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.type) {
      where.type = query.type;
    }

    const [plugins, total] = await Promise.all([
      this.prisma.plugin.findMany({
        where,
        orderBy: { downloads: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          author: true,
          version: true,
          description: true,
          icon: true,
          downloads: true,
          rating: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.plugin.count({ where }),
    ]);

    return {
      plugins,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findBySlug(slug: string) {
    const plugin = await this.prisma.plugin.findUnique({
      where: { slug },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!plugin) throw new NotFoundException(`Plugin '${slug}' not found`);
    return plugin;
  }

  async findById(id: string) {
    const plugin = await this.prisma.plugin.findUnique({ where: { id } });
    if (!plugin) throw new NotFoundException(`Plugin '${id}' not found`);
    return plugin;
  }

  async create(data: {
    name: string;
    slug: string;
    type: string;
    author: string;
    version: string;
    description: string;
    icon?: string;
    artifactUrl: string;
    checksum: string;
    changelog?: string;
    compatibility?: Record<string, unknown>;
  }) {
    const existing = await this.prisma.plugin.findUnique({
      where: { slug: data.slug },
    });
    if (existing) throw new ConflictException(`Plugin slug '${data.slug}' already exists`);

    const plugin = await this.prisma.plugin.create({
      data: {
        name: data.name,
        slug: data.slug,
        type: data.type,
        author: data.author,
        version: data.version,
        description: data.description,
        icon: data.icon,
        versions: {
          create: {
            semver: data.version,
            artifactUrl: data.artifactUrl,
            checksum: data.checksum,
            changelog: data.changelog,
            compatibility: data.compatibility ?? {},
          },
        },
      },
      include: { versions: true },
    });

    return plugin;
  }

  async install(
    pluginId: string,
    dto: InstallPluginDto,
    userId: string,
    userEmail: string,
  ) {
    const plugin = await this.findById(pluginId);

    const instanceId = dto.instanceId ?? 'default';
    const version = dto.version ?? plugin.version;

    const versionRecord = await this.prisma.pluginVersion.findUnique({
      where: { pluginId_semver: { pluginId, semver: version } },
    });
    if (!versionRecord) {
      throw new BadRequestException(`Version '${version}' not found for plugin '${plugin.slug}'`);
    }

    const existing = await this.prisma.pluginInstallation.findUnique({
      where: { instanceId_pluginId: { instanceId, pluginId } },
    });
    if (existing) throw new ConflictException('Plugin already installed on this instance');

    const installation = await this.prisma.pluginInstallation.create({
      data: {
        instanceId,
        pluginId,
        version,
        config: dto.config ?? {},
      },
    });

    await this.prisma.plugin.update({
      where: { id: pluginId },
      data: { downloads: { increment: 1 } },
    });

    await this.auditService.log({
      userId,
      userEmail,
      action: 'install',
      resource: 'plugins',
      resourceId: pluginId,
      detail: `Installed plugin '${plugin.slug}' v${version}`,
    });

    return installation;
  }

  async uninstall(pluginId: string, instanceId: string, userId: string, userEmail: string) {
    const plugin = await this.findById(pluginId);

    const installation = await this.prisma.pluginInstallation.findUnique({
      where: { instanceId_pluginId: { instanceId, pluginId } },
    });
    if (!installation) throw new NotFoundException('Plugin is not installed on this instance');

    await this.prisma.pluginInstallation.delete({
      where: { instanceId_pluginId: { instanceId, pluginId } },
    });

    await this.auditService.log({
      userId,
      userEmail,
      action: 'uninstall',
      resource: 'plugins',
      resourceId: pluginId,
      detail: `Uninstalled plugin '${plugin.slug}'`,
    });
  }

  async setEnabled(
    pluginId: string,
    enabled: boolean,
    instanceId: string,
    userId: string,
    userEmail: string,
  ) {
    const plugin = await this.findById(pluginId);

    const installation = await this.prisma.pluginInstallation.findUnique({
      where: { instanceId_pluginId: { instanceId, pluginId } },
    });
    if (!installation) throw new NotFoundException('Plugin is not installed on this instance');

    const updated = await this.prisma.pluginInstallation.update({
      where: { instanceId_pluginId: { instanceId, pluginId } },
      data: { enabled },
    });

    await this.auditService.log({
      userId,
      userEmail,
      action: enabled ? 'enable' : 'disable',
      resource: 'plugins',
      resourceId: pluginId,
      detail: `${enabled ? 'Enabled' : 'Disabled'} plugin '${plugin.slug}'`,
    });

    return updated;
  }

  async configure(
    pluginId: string,
    dto: ConfigurePluginDto,
    instanceId: string,
    userId: string,
    userEmail: string,
  ) {
    const plugin = await this.findById(pluginId);

    const installation = await this.prisma.pluginInstallation.findUnique({
      where: { instanceId_pluginId: { instanceId, pluginId } },
    });
    if (!installation) throw new NotFoundException('Plugin is not installed on this instance');

    const updated = await this.prisma.pluginInstallation.update({
      where: { instanceId_pluginId: { instanceId, pluginId } },
      data: { config: dto.config },
    });

    await this.auditService.log({
      userId,
      userEmail,
      action: 'configure',
      resource: 'plugins',
      resourceId: pluginId,
      detail: `Updated config for plugin '${plugin.slug}'`,
    });

    return updated;
  }
}
