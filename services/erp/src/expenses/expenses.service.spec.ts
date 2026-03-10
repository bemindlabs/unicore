import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  expense: {
    create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(),
    update: jest.fn(), delete: jest.fn(), count: jest.fn(),
    aggregate: jest.fn(), groupBy: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ExpensesService', () => {
  let service: ExpensesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an expense', async () => {
      const dto = { title: 'Office Supplies', category: 'supplies', amount: 49.99 };
      const expected = { id: 'exp-1', ...dto, status: 'PENDING' };
      mockPrisma.expense.create.mockResolvedValue(expected);

      const result = await service.create(dto as any);
      expect(result.status).toBe('PENDING');
    });
  });

  describe('approve', () => {
    it('should approve a PENDING expense', async () => {
      const expense = { id: 'exp-1', status: 'PENDING' };
      const approved = { ...expense, status: 'APPROVED', approvedBy: 'manager@co.com' };
      mockPrisma.expense.findUnique.mockResolvedValue(expense);
      mockPrisma.expense.update.mockResolvedValue(approved);

      const result = await service.approve('exp-1', { approvedBy: 'manager@co.com' } as any);
      expect(result.status).toBe('APPROVED');
    });

    it('should throw if expense is not PENDING', async () => {
      const expense = { id: 'exp-1', status: 'APPROVED' };
      mockPrisma.expense.findUnique.mockResolvedValue(expense);

      await expect(
        service.approve('exp-1', { approvedBy: 'manager@co.com' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reimburse', () => {
    it('should throw if expense is not APPROVED', async () => {
      const expense = { id: 'exp-1', status: 'PENDING' };
      mockPrisma.expense.findUnique.mockResolvedValue(expense);

      await expect(service.reimburse('exp-1')).rejects.toThrow(BadRequestException);
    });
  });
});
