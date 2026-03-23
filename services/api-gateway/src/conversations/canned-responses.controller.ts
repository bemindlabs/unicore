import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CannedResponsesService } from './canned-responses.service';
import { CreateCannedResponseDto, UpdateCannedResponseDto } from './dto/canned-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/v1/conversations/canned-responses')
export class CannedResponsesController {
  constructor(private readonly cannedResponsesService: CannedResponsesService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cannedResponsesService.list({
      search,
      category,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Post()
  create(@Body() dto: CreateCannedResponseDto, @CurrentUser() user: any) {
    return this.cannedResponsesService.create(dto, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCannedResponseDto) {
    return this.cannedResponsesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.cannedResponsesService.remove(id);
  }
}
