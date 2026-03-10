import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { ApproveExpenseDto } from './dto/approve-expense.dto';
import { RejectExpenseDto } from './dto/reject-expense.dto';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';

type ExpenseRecord = Prisma.ExpenseGetPayload<Record<string, never>>;

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateExpenseDto): Promise<ExpenseRecord> {
    const expense = await this.prisma.expense.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
        status: 'PENDING',
        vendor: dto.vendor,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        submittedBy: dto.submittedBy,
        notes: dto.notes,
        tags: dto.tags ?? [],
      },
    });
    this.logger.log(`Expense created: ${expense.id} (${expense.title})`);
    return expense;
  }

  async findAll(
    query: QueryExpensesDto,
  ): Promise<PaginatedResult<ExpenseRecord>> {
    const { page = 1, limit = 20, search, status, category } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {
      ...(status && { status }),
      ...(category && { category }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { vendor: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<ExpenseRecord> {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException(`Expense ${id} not found`);
    return expense;
  }

  async update(id: string, dto: UpdateExpenseDto): Promise<ExpenseRecord> {
    const expense = await this.findOne(id);

    if (expense.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot edit expense in ${expense.status} status`,
      );
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.vendor !== undefined && { vendor: dto.vendor }),
        ...(dto.paidAt !== undefined && {
          paidAt: dto.paidAt ? new Date(dto.paidAt) : null,
        }),
        ...(dto.submittedBy !== undefined && { submittedBy: dto.submittedBy }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
      },
    });
  }

  async remove(id: string): Promise<void> {
    const expense = await this.findOne(id);
    if (expense.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot delete expense in ${expense.status} status`,
      );
    }
    await this.prisma.expense.delete({ where: { id } });
    this.logger.log(`Expense deleted: ${id}`);
  }

  async approve(id: string, dto: ApproveExpenseDto): Promise<ExpenseRecord> {
    const expense = await this.findOne(id);
    if (expense.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot approve expense in ${expense.status} status`,
      );
    }
    return this.prisma.expense.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: dto.approvedBy,
        ...(dto.notes && { notes: dto.notes }),
      },
    });
  }

  async reject(id: string, dto: RejectExpenseDto): Promise<ExpenseRecord> {
    const expense = await this.findOne(id);
    if (expense.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot reject expense in ${expense.status} status`,
      );
    }
    return this.prisma.expense.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: dto.approvedBy,
        ...(dto.reason && { notes: dto.reason }),
      },
    });
  }

  async reimburse(id: string): Promise<ExpenseRecord> {
    const expense = await this.findOne(id);
    if (expense.status !== 'APPROVED') {
      throw new BadRequestException(
        `Only APPROVED expenses can be reimbursed. Current: ${expense.status}`,
      );
    }
    return this.prisma.expense.update({
      where: { id },
      data: { status: 'REIMBURSED' },
    });
  }

  async uploadReceipt(id: string, receiptUrl: string): Promise<ExpenseRecord> {
    await this.findOne(id);
    return this.prisma.expense.update({
      where: { id },
      data: { receiptUrl },
    });
  }
}
