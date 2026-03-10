import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { Prisma } from '@prisma/client';

export type ContactRecord = Awaited<
  ReturnType<PrismaService['contact']['findUniqueOrThrow']>
>;

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContactDto): Promise<ContactRecord> {
    if (dto.email) {
      const existing = await this.prisma.contact.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException(
          `A contact with email ${dto.email} already exists`,
        );
      }
    }

    const contact = await this.prisma.contact.create({ data: dto as Prisma.ContactCreateInput });
    this.logger.log(`Contact created: ${contact.id}`);
    return contact;
  }

  async findAll(
    query: QueryContactsDto,
  ): Promise<PaginatedResult<ContactRecord>> {
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
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
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
      const existing = await this.prisma.contact.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(
          `A contact with email ${dto.email} already exists`,
        );
      }
    }

    return this.prisma.contact.update({ where: { id }, data: dto as Prisma.ContactUpdateInput });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.contact.delete({ where: { id } });
    this.logger.log(`Contact deleted: ${id}`);
  }

  async updateLeadScore(id: string, score: number): Promise<ContactRecord> {
    await this.findOne(id);
    return this.prisma.contact.update({
      where: { id },
      data: { leadScore: score },
    });
  }

  async getLeadsByScore(
    minScore: number,
    limit = 20,
  ): Promise<ContactRecord[]> {
    return this.prisma.contact.findMany({
      where: {
        type: 'LEAD',
        leadScore: { gte: minScore },
      },
      orderBy: { leadScore: 'desc' },
      take: limit,
    });
  }
}
