import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  contact: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ContactsService — create / update / remove / getTopLeads', () => {
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

  describe('create', () => {
    it('creates a contact when no email conflict', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);
      const created = { id: '1', name: 'Jane Doe', email: 'jane@example.com' };
      mockPrisma.contact.create.mockResolvedValue(created);

      const result = await service.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' });
      expect(result).toEqual(created);
      expect(mockPrisma.contact.create).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when email already in use', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({ id: 'other', email: 'jane@example.com' });

      await expect(
        service.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockPrisma.contact.create).not.toHaveBeenCalled();
    });

    it('creates a contact without email, skipping uniqueness check', async () => {
      const created = { id: '2', name: 'No Email' };
      mockPrisma.contact.create.mockResolvedValue(created);

      await service.create({ firstName: 'No', lastName: 'Email' });
      expect(mockPrisma.contact.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.contact.create).toHaveBeenCalledTimes(1);
    });

    it('defaults type to LEAD and leadScore to 0', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);
      mockPrisma.contact.create.mockResolvedValue({ id: '3' });

      await service.create({ firstName: 'Test', lastName: 'User', email: 'test@example.com' });
      const createCall = mockPrisma.contact.create.mock.calls[0][0];
      expect(createCall.data.type).toBe('LEAD');
      expect(createCall.data.leadScore).toBe(0);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when contact does not exist', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { firstName: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when email is already taken by another contact', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({ id: '1' });
      mockPrisma.contact.findFirst.mockResolvedValue({ id: '2', email: 'taken@example.com' });

      await expect(service.update('1', { email: 'taken@example.com' })).rejects.toBeInstanceOf(ConflictException);
      expect(mockPrisma.contact.update).not.toHaveBeenCalled();
    });

    it('updates successfully when email is not conflicting', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({ id: '1' });
      mockPrisma.contact.findFirst.mockResolvedValue(null);
      mockPrisma.contact.update.mockResolvedValue({ id: '1', name: 'Updated Name' });

      const result = await service.update('1', { firstName: 'Updated', lastName: 'Name', email: 'unique@example.com' });
      expect(result.name).toBe('Updated Name');
    });

    it('skips email uniqueness check when no email in dto', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({ id: '1' });
      mockPrisma.contact.update.mockResolvedValue({ id: '1', company: 'Acme' });

      await service.update('1', { company: 'Acme' });
      expect(mockPrisma.contact.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when contact does not exist', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes existing contact', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({ id: '1' });
      mockPrisma.contact.delete.mockResolvedValue({ id: '1' });

      await expect(service.remove('1')).resolves.toBeUndefined();
      expect(mockPrisma.contact.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('getTopLeads', () => {
    it('returns leads above minScore ordered by score descending', async () => {
      const leads = [
        { id: '1', type: 'LEAD', leadScore: 90 },
        { id: '2', type: 'LEAD', leadScore: 75 },
      ];
      mockPrisma.contact.findMany.mockResolvedValue(leads);

      const result = await service.getTopLeads(70);
      expect(result).toEqual(leads);
      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'LEAD', leadScore: { gte: 70 } },
          orderBy: { leadScore: 'desc' },
          take: 20,
        }),
      );
    });

    it('respects a custom limit', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([]);
      await service.getTopLeads(50, 5);
      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });
});
