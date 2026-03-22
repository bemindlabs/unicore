import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  expense: {
    findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(),
    update: jest.fn(), delete: jest.fn(), count: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ExpensesService — CRUD extensions', () => {
  let service: ExpensesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ExpensesService>(ExpensesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates an expense with DRAFT status', async () => {
      const expense = {
        id: 'exp-1', title: 'Office Supplies', status: 'DRAFT', amount: 50, currency: 'USD',
      };
      mockPrisma.expense.create.mockResolvedValue(expense);

      const result = await service.create({
        title: 'Office Supplies', category: 'OFFICE_SUPPLIES', amount: 50,
      });
      expect(result.status).toBe('DRAFT');
      const createCall = mockPrisma.expense.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('DRAFT');
    });

    it('defaults currency to USD', async () => {
      mockPrisma.expense.create.mockResolvedValue({ id: 'exp-2', currency: 'USD' });

      await service.create({ title: 'Coffee', category: 'MEALS', amount: 10 });
      const createCall = mockPrisma.expense.create.mock.calls[0][0];
      expect(createCall.data.currency).toBe('USD');
    });

    it('uses provided currency when specified', async () => {
      mockPrisma.expense.create.mockResolvedValue({ id: 'exp-3', currency: 'EUR' });

      await service.create({ title: 'Flight', category: 'TRAVEL', amount: 500, currency: 'EUR' });
      const createCall = mockPrisma.expense.create.mock.calls[0][0];
      expect(createCall.data.currency).toBe('EUR');
    });
  });

  describe('findAll', () => {
    it('returns paginated expenses', async () => {
      mockPrisma.$transaction.mockResolvedValue([[{ id: 'exp-1', status: 'DRAFT' }], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('applies status and category filters', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await service.findAll({ page: 1, limit: 20, status: 'SUBMITTED' as any, category: 'TRAVEL' });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when expense does not exist', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns expense when found', async () => {
      const expense = { id: 'exp-1', status: 'DRAFT' };
      mockPrisma.expense.findUnique.mockResolvedValue(expense);
      const result = await service.findOne('exp-1');
      expect(result).toEqual(expense);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when expense does not exist', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { title: 'New' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when expense is not DRAFT', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({ id: 'exp-1', status: 'SUBMITTED' });
      await expect(service.update('exp-1', { title: 'New' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates a DRAFT expense', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({ id: 'exp-1', status: 'DRAFT' });
      mockPrisma.expense.update.mockResolvedValue({ id: 'exp-1', status: 'DRAFT', title: 'Updated' });

      const result = await service.update('exp-1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when expense does not exist', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when expense is not DRAFT', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({ id: 'exp-1', status: 'APPROVED' });
      await expect(service.remove('exp-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deletes a DRAFT expense', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({ id: 'exp-1', status: 'DRAFT' });
      mockPrisma.expense.delete.mockResolvedValue({ id: 'exp-1' });

      await expect(service.remove('exp-1')).resolves.toBeUndefined();
      expect(mockPrisma.expense.delete).toHaveBeenCalledWith({ where: { id: 'exp-1' } });
    });
  });

  describe('reject', () => {
    it('throws NotFoundException when expense does not exist', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);
      await expect(service.reject('missing', { approvedBy: 'mgr', reason: 'No receipt' }))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when expense is not SUBMITTED', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({ id: 'exp-1', status: 'DRAFT' });
      await expect(service.reject('exp-1', { approvedBy: 'mgr' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a SUBMITTED expense', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({ id: 'exp-1', status: 'SUBMITTED' });
      mockPrisma.expense.update.mockResolvedValue({
        id: 'exp-1', status: 'REJECTED', approvedById: 'mgr', rejectedReason: 'No receipt',
      });

      const result = await service.reject('exp-1', { approvedBy: 'mgr', reason: 'No receipt' });
      expect(result.status).toBe('REJECTED');
    });
  });

  describe('reimburse', () => {
    it('reimburses an APPROVED expense', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({ id: 'exp-1', status: 'APPROVED' });
      mockPrisma.expense.update.mockResolvedValue({ id: 'exp-1', status: 'REIMBURSED' });

      const result = await service.reimburse('exp-1');
      expect(result.status).toBe('REIMBURSED');
      expect(mockPrisma.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'REIMBURSED' } }),
      );
    });
  });

  describe('uploadReceipt', () => {
    it('throws NotFoundException when expense does not exist', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);
      await expect(service.uploadReceipt('missing', 'https://bucket.s3.example.com/receipt.pdf'))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates receiptUrl on existing expense', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({ id: 'exp-1', status: 'APPROVED' });
      mockPrisma.expense.update.mockResolvedValue({
        id: 'exp-1', receiptUrl: 'https://bucket.s3.example.com/receipt.pdf',
      });

      const result = await service.uploadReceipt('exp-1', 'https://bucket.s3.example.com/receipt.pdf');
      expect(result.receiptUrl).toBe('https://bucket.s3.example.com/receipt.pdf');
    });
  });
});
