import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

const mockPrisma = {
  expense: {
    findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(),
    update: jest.fn(), delete: jest.fn(), count: jest.fn(),
  },
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
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  describe('approve', () => {
    it('throws when expense is not PENDING', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({ id: '1', status: 'APPROVED' });
      await expect(service.approve('1', { approvedBy: 'manager' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('approves a PENDING expense', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({ id: '1', status: 'PENDING' });
      mockPrisma.expense.update.mockResolvedValue({ id: '1', status: 'APPROVED', approvedBy: 'manager' });
      const result = await service.approve('1', { approvedBy: 'manager' });
      expect(result.status).toBe('APPROVED');
    });
  });

  describe('reimburse', () => {
    it('throws when expense is not APPROVED', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({ id: '1', status: 'PENDING' });
      await expect(service.reimburse('1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
