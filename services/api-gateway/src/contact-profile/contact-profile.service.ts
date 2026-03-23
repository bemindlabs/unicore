import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentNoteDto, UpdateAgentNoteDto, UpsertContactChannelDto } from './dto/agent-note.dto';
import { MergeContactsDto } from './dto/merge-contacts.dto';

const ERP_BASE = process.env.ERP_URL ?? 'http://erp:4100';
const INTERNAL_HEADER = { 'X-Internal-Service': 'api-gateway', 'Content-Type': 'application/json' };

@Injectable()
export class ContactProfileService {
  private readonly logger = new Logger(ContactProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // ERP helpers
  // ------------------------------------------------------------------

  private async erpGet<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${ERP_BASE}/api/v1${path}`, {
      headers: INTERNAL_HEADER,
    });
    if (res.status === 404) throw new NotFoundException(`ERP resource not found: ${path}`);
    if (!res.ok) throw new BadRequestException(`ERP error ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }

  private async erpPut<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${ERP_BASE}/api/v1${path}`, {
      method: 'PUT',
      headers: INTERNAL_HEADER,
      body: JSON.stringify(body),
    });
    if (res.status === 404) throw new NotFoundException(`ERP resource not found: ${path}`);
    if (!res.ok) throw new BadRequestException(`ERP error ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }

  private async erpDelete(path: string): Promise<void> {
    const res = await fetch(`${ERP_BASE}/api/v1${path}`, {
      method: 'DELETE',
      headers: INTERNAL_HEADER,
    });
    if (res.status === 404) throw new NotFoundException(`ERP resource not found: ${path}`);
    if (!res.ok) throw new BadRequestException(`ERP error ${res.status}: ${path}`);
  }

  // ------------------------------------------------------------------
  // Contact profile (aggregates ERP data + gateway data)
  // ------------------------------------------------------------------

  async getProfile(contactId: string) {
    const [erpContact, channels, notes, conversationHistory] = await Promise.all([
      this.erpGet(`/contacts/${contactId}`),
      this.prisma.contactChannel.findMany({ where: { contactId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.agentNote.findMany({ where: { contactId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.conversation.findMany({
        where: { contactId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          channel: true,
          assigneeName: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
      }),
    ]);

    return {
      contact: erpContact,
      channels,
      notes,
      conversationHistory,
    };
  }

  /** Search ERP contacts by name / email for the merge picker. */
  async searchContacts(query: string) {
    return this.erpGet(`/contacts?search=${encodeURIComponent(query)}&limit=10`);
  }

  // ------------------------------------------------------------------
  // Agent notes
  // ------------------------------------------------------------------

  async listNotes(contactId: string) {
    return this.prisma.agentNote.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createNote(contactId: string, dto: CreateAgentNoteDto, authorId: string, authorName: string) {
    const note = await this.prisma.agentNote.create({
      data: { contactId, body: dto.body, authorId, authorName },
    });
    this.logger.log(`Agent note created: ${note.id} for contact ${contactId}`);
    return note;
  }

  async updateNote(contactId: string, noteId: string, dto: UpdateAgentNoteDto, requesterId: string) {
    const note = await this.prisma.agentNote.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException(`Note ${noteId} not found`);
    if (note.contactId !== contactId) throw new NotFoundException(`Note ${noteId} not found`);
    if (note.authorId !== requesterId) {
      throw new BadRequestException('Only the note author can edit it');
    }
    return this.prisma.agentNote.update({ where: { id: noteId }, data: { body: dto.body } });
  }

  async deleteNote(contactId: string, noteId: string, requesterId: string) {
    const note = await this.prisma.agentNote.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException(`Note ${noteId} not found`);
    if (note.contactId !== contactId) throw new NotFoundException(`Note ${noteId} not found`);
    if (note.authorId !== requesterId) {
      throw new BadRequestException('Only the note author can delete it');
    }
    await this.prisma.agentNote.delete({ where: { id: noteId } });
    return { deleted: true };
  }

  // ------------------------------------------------------------------
  // Contact channels
  // ------------------------------------------------------------------

  async listChannels(contactId: string) {
    return this.prisma.contactChannel.findMany({ where: { contactId }, orderBy: { channel: 'asc' } });
  }

  async upsertChannel(contactId: string, dto: UpsertContactChannelDto) {
    return this.prisma.contactChannel.upsert({
      where: { contactId_channel: { contactId, channel: dto.channel } },
      create: {
        contactId,
        channel: dto.channel,
        channelUserId: dto.channelUserId,
        displayName: dto.displayName,
      },
      update: {
        channelUserId: dto.channelUserId,
        displayName: dto.displayName,
        isActive: true,
      },
    });
  }

  async removeChannel(contactId: string, channel: string) {
    const record = await this.prisma.contactChannel.findUnique({
      where: { contactId_channel: { contactId, channel } },
    });
    if (!record) throw new NotFoundException(`Channel binding not found`);
    await this.prisma.contactChannel.delete({ where: { contactId_channel: { contactId, channel } } });
    return { deleted: true };
  }

  // ------------------------------------------------------------------
  // Merge duplicate contacts
  // ------------------------------------------------------------------

  async mergeContacts(dto: MergeContactsDto) {
    if (dto.duplicateIds.includes(dto.primaryId)) {
      throw new BadRequestException('primaryId cannot appear in duplicateIds');
    }

    // Verify primary exists in ERP
    await this.erpGet(`/contacts/${dto.primaryId}`);

    // Re-parent gateway records to the primary contact
    await this.prisma.$transaction([
      this.prisma.agentNote.updateMany({
        where: { contactId: { in: dto.duplicateIds } },
        data: { contactId: dto.primaryId },
      }),
      this.prisma.contactChannel.deleteMany({
        where: { contactId: { in: dto.duplicateIds } },
      }),
      this.prisma.conversation.updateMany({
        where: { contactId: { in: dto.duplicateIds } },
        data: { contactId: dto.primaryId },
      }),
    ]);

    // Delete duplicates in ERP (best-effort — log on failure)
    for (const dupId of dto.duplicateIds) {
      try {
        await this.erpDelete(`/contacts/${dupId}`);
      } catch (err) {
        this.logger.warn(`Could not delete ERP contact ${dupId} during merge: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Merged contacts ${dto.duplicateIds.join(', ')} → ${dto.primaryId}`);
    return { primaryId: dto.primaryId, merged: dto.duplicateIds };
  }
}
