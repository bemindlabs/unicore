import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/dto/pagination.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { ApproveExpenseDto } from './dto/approve-expense.dto';
import { RejectExpenseDto } from './dto/reject-expense.dto';
import { Prisma, ExpenseStatus } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);
  private readonly uploadDir = process.env.RECEIPT_UPLOAD_DIR ?? '/tmp/receipts';

  constructor(private readonly prisma: PrismaService) {
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async findAll(query: QueryExpensesDto) {
    const { page = 1, limit = 20, search, category, submittedBy, status } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.ExpenseWhereInput = {};
    if (category) where.category = category;
    if (submittedBy) where.submittedBy = submittedBy;
    if (status) where.status = status as ExpenseStatus;
    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { vendor: { contains: search, mode: 'insensitive' } },
    ];

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.expense.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException(`Expense ${id} not found`);
    return expense;
  }

  async create(dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
        vendor: dto.vendor,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        submittedBy: dto.submittedBy,
        notes: dto.notes,
        tags: dto.tags ?? [],
      },
    });
  }

  async update(id: string, dto: UpdateExpenseDto) {
    const expense = await this.findOne(id);
    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException('Only PENDING expenses can be updated');
    }
    return this.prisma.expense.update({ where: { id }, data: dto as Prisma.ExpenseUpdateInput });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.expense.delete({ where: { id } });
  }

  async approve(id: string, dto: ApproveExpenseDto) {
    const expense = await this.findOne(id);
    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException(`Cannot approve expense with status ${expense.status}`);
    }
    return this.prisma.expense.update({
      where: { id },
      data: { status: ExpenseStatus.APPROVED, approvedBy: dto.approvedBy, notes: dto.notes },
    });
  }

  async reject(id: string, dto: RejectExpenseDto) {
    const expense = await this.findOne(id);
    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException(`Cannot reject expense with status ${expense.status}`);
    }
    return this.prisma.expense.update({
      where: { id },
      data: { status: ExpenseStatus.REJECTED, notes: dto.reason },
    });
  }

  async reimburse(id: string) {
    const expense = await this.findOne(id);
    if (expense.status !== ExpenseStatus.APPROVED) {
      throw new BadRequestException('Only APPROVED expenses can be reimbursed');
    }
    return this.prisma.expense.update({
      where: { id },
      data: { status: ExpenseStatus.REIMBURSED, paidAt: new Date() },
    });
  }

  async uploadReceipt(id: string, file: Express.Multer.File) {
    await this.findOne(id);
    const ext = path.extname(file.originalname);
    const filename = `receipt-${id}${ext}`;
    const filepath = path.join(this.uploadDir, filename);
    fs.writeFileSync(filepath, file.buffer);
    const receiptUrl = `/receipts/${filename}`;
    return this.prisma.expense.update({ where: { id }, data: { receiptUrl } });
  }
}
