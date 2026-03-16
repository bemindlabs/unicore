import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':key')
  async get(@Param('key') key: string) {
    const settings = await this.prisma.settings.findUnique({ where: { id: key } });
    return settings?.data ?? {};
  }

  @Put(':key')
  async put(@Param('key') key: string, @Body() body: any) {
    const settings = await this.prisma.settings.upsert({
      where: { id: key },
      create: { id: key, data: body },
      update: { data: body },
    });
    return settings.data;
  }
}
