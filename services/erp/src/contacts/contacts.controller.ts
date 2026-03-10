import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, ParseUUIDPipe, ParseIntPipe,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';

@Controller('erp/contacts')
export class ContactsController {
  constructor(private readonly svc: ContactsService) {}

  @Post() create(@Body() dto: CreateContactDto) { return this.svc.create(dto); }
  @Get() findAll(@Query() q: QueryContactsDto) { return this.svc.findAll(q); }
  @Get('leads/top') getTopLeads(
    @Query('minScore', new ParseIntPipe({ optional: true })) s = 50,
    @Query('limit', new ParseIntPipe({ optional: true })) l = 20,
  ) { return this.svc.getTopLeads(s, l); }
  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactDto) { return this.svc.update(id, dto); }
  @Patch(':id/lead-score') updateLeadScore(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('score', ParseIntPipe) score: number,
  ) { return this.svc.updateLeadScore(id, score); }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(id); }
}
