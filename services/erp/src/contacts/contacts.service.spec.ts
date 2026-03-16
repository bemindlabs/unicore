import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  contact: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ContactsService', () => {
  let service: ContactsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ContactsService>(ContactsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  describe('findAll', () => {
    it('returns paginated results', async () => {
      mockPrisma.$transaction.mockResolvedValue([[{ id: '1', firstName: 'John' }], 1]);
      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow('not found');
    });
  });

  describe('updateLeadScore', () => {
    it('passes through the score value', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({ id: '1' });
      mockPrisma.contact.update.mockResolvedValue({ id: '1', leadScore: 150 });
      await service.updateLeadScore('1', 150);
      expect(mockPrisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ leadScore: 150 }) })
      );
    });
  });
});
