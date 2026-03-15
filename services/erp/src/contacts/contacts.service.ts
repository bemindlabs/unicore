import {
  Injectable, NotFoundException, ConflictException, Logger,
} from '@nestjs/common';
import { Prisma, Contact } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';

type ContactRecord = Contact;

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContactDto): Promise<ContactRecord> {
    if (dto.email) {
      const existing = await this.prisma.contact.findUnique({ where: { email: dto.email } });
      if (existing) throw new ConflictException(`A contact with email ${dto.email} already exists`);
    }
    const contact = await this.prisma.contact.create({
      data: {
        type: dto.type ?? 'LEAD',
        name: `${dto.firstName} ${dto.lastName}`.trim(),
        email: dto.email,
        phone: dto.phone,
        company: dto.company,
        website: dto.website,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        currency: dto.currency ?? 'USD',
        leadScore: dto.leadScore ?? 0,
        tags: dto.tags ?? [],
        ...(dto.notes && { notes: { create: { body: dto.notes, authorId: '00000000-0000-0000-0000-000000000000' } } }),
      },
    });
    this.logger.log(`Contact created: ${contact.id}`);
    return contact;
  }

  async findAll(query: QueryContactsDto): Promise<PaginatedResult<ContactRecord>> {
    const { page = 1, limit = 20, search, type, minLeadScore } = query;
    const skip = (page - 1) * limit;
    const where = {
      ...(type && { type }),
      ...(minLeadScore !== undefined && { leadScore: { gte: minLeadScore } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { company: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    } satisfies Prisma.ContactWhereInput;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.contact.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<ContactRecord> {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException(`Contact ${id} not found`);
    return contact;
  }

  async update(id: string, dto: UpdateContactDto): Promise<ContactRecord> {
    await this.findOne(id);
    if (dto.email) {
      const existing = await this.prisma.contact.findFirst({ where: { email: dto.email, NOT: { id } } });
      if (existing) throw new ConflictException(`A contact with email ${dto.email} already exists`);
    }
    const nameUpdate = (dto.firstName !== undefined || dto.lastName !== undefined)
      ? { name: `${dto.firstName ?? ''} ${dto.lastName ?? ''}`.trim() }
      : {};
    return this.prisma.contact.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...nameUpdate,
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.leadScore !== undefined && { leadScore: dto.leadScore }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.notes !== undefined && { notes: { create: { body: dto.notes, authorId: '00000000-0000-0000-0000-000000000000' } } }),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.contact.delete({ where: { id } });
    this.logger.log(`Contact deleted: ${id}`);
  }

  async updateLeadScore(id: string, score: number): Promise<ContactRecord> {
    await this.findOne(id);
    return this.prisma.contact.update({ where: { id }, data: { leadScore: score } });
  }

  async getTopLeads(minScore: number, limit = 20): Promise<ContactRecord[]> {
    return this.prisma.contact.findMany({
      where: { type: 'LEAD', leadScore: { gte: minScore } },
      orderBy: { leadScore: 'desc' },
      take: limit,
    });
  }
}
