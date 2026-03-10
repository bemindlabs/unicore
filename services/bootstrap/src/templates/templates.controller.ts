import { Controller, Get, Param } from '@nestjs/common';
import { TemplatesService } from './templates.service';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  findAll() {
    return {
      success: true,
      data: this.templatesService.findAll(),
    };
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return {
      success: true,
      data: this.templatesService.findById(id),
    };
  }
}
