import {
  Injectable, NotFoundException, ConflictException, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';

type ContactRecord = Prisma.ContactGetPayload<Record<string, never>>;

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
        firstName: dto.firstName,
        lastName: dto.lastName,
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
        notes: dto.notes,
      },
    });
    this.logger.log(`Contact created: ${contact.id}`);
    return contact;
  }

  async findAll(query: QueryContactsDto): Promise<PaginatedResult<ContactRecord>> {
    const { page = 1, limit = 20, search, type, minLeadScore } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.ContactWhereInput = {
      ...(type && { type }),
      ...(minLeadScore !== undefined && { leadScore: { gte: minLeadScore } }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
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
    return this.prisma.contact.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
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
        ...(dto.notes !== undefined && { notes: dto.notes }),
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
