import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { PromptService } from './service/prompt.service';
import {
  RegisterPromptDto,
  RenderPromptDto,
  UpdatePromptDto,
} from '../common/dto/prompt-request.dto';

@Controller('prompts')
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterPromptDto) {
    return this.promptService.register(dto);
  }

  @Get()
  list(@Query('tag') tag?: string) {
    return this.promptService.list(tag);
  }

  @Get(':key')
  get(@Param('key') key: string) {
    return this.promptService.get(key);
  }

  @Put(':key')
  update(@Param('key') key: string, @Body() dto: UpdatePromptDto) {
    return this.promptService.update(key, dto);
  }

  @Patch(':key/version/:version')
  setActiveVersion(
    @Param('key') key: string,
    @Param('version') version: string,
  ) {
    return this.promptService.setActiveVersion(key, parseInt(version, 10));
  }

  @Post(':key/render')
  @HttpCode(HttpStatus.OK)
  render(@Param('key') key: string, @Body() dto: RenderPromptDto) {
    const rendered = this.promptService.render(
      key,
      dto.variables ?? {},
      { version: dto.version, strict: dto.strict },
    );
    return { key, rendered };
  }
}
