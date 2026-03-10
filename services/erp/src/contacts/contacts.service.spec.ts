import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  contact: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
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
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a contact successfully', async () => {
      const dto = { firstName: 'John', lastName: 'Doe', email: 'john@example.com' };
      const expected = { id: 'uuid-1', ...dto, type: 'LEAD', leadScore: 0 };
      mockPrisma.contact.findUnique.mockResolvedValue(null);
      mockPrisma.contact.create.mockResolvedValue(expected);

      const result = await service.create(dto as any);

      expect(result).toEqual(expected);
      expect(mockPrisma.contact.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ firstName: 'John', lastName: 'Doe', email: 'existing@example.com' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should return a contact by id', async () => {
      const contact = { id: 'uuid-1', firstName: 'John', lastName: 'Doe' };
      mockPrisma.contact.findUnique.mockResolvedValue(contact);

      const result = await service.findOne('uuid-1');
      expect(result).toEqual(contact);
    });

    it('should throw NotFoundException when contact not found', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateLeadScore', () => {
    it('should update lead score', async () => {
      const contact = { id: 'uuid-1', leadScore: 0 };
      const updated = { ...contact, leadScore: 75 };
      mockPrisma.contact.findUnique.mockResolvedValue(contact);
      mockPrisma.contact.update.mockResolvedValue(updated);

      const result = await service.updateLeadScore('uuid-1', 75);
      expect(result.leadScore).toBe(75);
    });
  });

  describe('findAll', () => {
    it('should return paginated contacts', async () => {
      const contacts = [{ id: 'uuid-1' }, { id: 'uuid-2' }];
      mockPrisma.$transaction.mockResolvedValue([contacts, 2]);

      const result = await service.findAll({ page: 1, limit: 20 } as any);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });
});
