import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ContactProfileService } from './contact-profile.service';
import { ContactProfileGateway } from './contact-profile.gateway';
import { CreateAgentNoteDto, UpdateAgentNoteDto, UpsertContactChannelDto } from './dto/agent-note.dto';
import { MergeContactsDto } from './dto/merge-contacts.dto';

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

@UseGuards(JwtAuthGuard)
@Controller('api/v1/contact-profile')
export class ContactProfileController {
  constructor(
    private readonly svc: ContactProfileService,
    private readonly gateway: ContactProfileGateway,
  ) {}

  // ------------------------------------------------------------------
  // Profile (aggregated view)
  // ------------------------------------------------------------------

  @Get(':contactId')
  getProfile(@Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.svc.getProfile(contactId);
  }

  @Get('search')
  searchContacts(@Query('q') q: string) {
    return this.svc.searchContacts(q ?? '');
  }

  // ------------------------------------------------------------------
  // Agent notes
  // ------------------------------------------------------------------

  @Get(':contactId/notes')
  listNotes(@Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.svc.listNotes(contactId);
  }

  @Post(':contactId/notes')
  async createNote(
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: CreateAgentNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    const note = await this.svc.createNote(contactId, dto, user.id, user.name);
    this.gateway.emitNoteCreated(contactId, note);
    return note;
  }

  @Put(':contactId/notes/:noteId')
  async updateNote(
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateAgentNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    const note = await this.svc.updateNote(contactId, noteId, dto, user.id);
    this.gateway.emitNoteUpdated(contactId, note);
    return note;
  }

  @Delete(':contactId/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNote(
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.svc.deleteNote(contactId, noteId, user.id);
    this.gateway.emitNoteDeleted(contactId, noteId);
  }

  // ------------------------------------------------------------------
  // Contact channels
  // ------------------------------------------------------------------

  @Get(':contactId/channels')
  listChannels(@Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.svc.listChannels(contactId);
  }

  @Put(':contactId/channels')
  async upsertChannel(
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpsertContactChannelDto,
  ) {
    const channel = await this.svc.upsertChannel(contactId, dto);
    this.gateway.emitChannelUpdated(contactId, channel);
    return channel;
  }

  @Delete(':contactId/channels/:channel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeChannel(
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Param('channel') channel: string,
  ) {
    await this.svc.removeChannel(contactId, channel);
  }

  // ------------------------------------------------------------------
  // Merge
  // ------------------------------------------------------------------

  @Post('merge')
  mergeContacts(@Body() dto: MergeContactsDto) {
    return this.svc.mergeContacts(dto);
  }
}
