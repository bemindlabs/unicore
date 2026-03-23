import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ContactProfileService } from './contact-profile.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock global fetch for ERP calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockPrisma = {
  contactChannel: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
  },
  agentNote: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateMany: jest.fn(),
  },
  conversation: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ContactProfileService', () => {
  let service: ContactProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactProfileService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ContactProfileService>(ContactProfileService);
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // getProfile
  // ----------------------------------------------------------------

  describe('getProfile', () => {
    it('returns aggregated profile data', async () => {
      const contact = { id: 'c1', name: 'Alice' };
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => contact });
      mockPrisma.contactChannel.findMany.mockResolvedValue([]);
      mockPrisma.agentNote.findMany.mockResolvedValue([]);
      mockPrisma.conversation.findMany.mockResolvedValue([]);

      const result = await service.getProfile('c1');

      expect(result.contact).toEqual(contact);
      expect(result.channels).toEqual([]);
      expect(result.notes).toEqual([]);
      expect(result.conversationHistory).toEqual([]);
    });

    it('throws NotFoundException when ERP returns 404', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
      mockPrisma.contactChannel.findMany.mockResolvedValue([]);
      mockPrisma.agentNote.findMany.mockResolvedValue([]);
      mockPrisma.conversation.findMany.mockResolvedValue([]);

      await expect(service.getProfile('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------------
  // Agent notes
  // ----------------------------------------------------------------

  describe('createNote', () => {
    it('creates and returns a note', async () => {
      const note = { id: 'n1', contactId: 'c1', body: 'hi', authorId: 'u1', authorName: 'Bob' };
      mockPrisma.agentNote.create.mockResolvedValue(note);

      const result = await service.createNote('c1', { body: 'hi' }, 'u1', 'Bob');
      expect(result).toEqual(note);
      expect(mockPrisma.agentNote.create).toHaveBeenCalledWith({
        data: { contactId: 'c1', body: 'hi', authorId: 'u1', authorName: 'Bob' },
      });
    });
  });

  describe('updateNote', () => {
    it('updates a note authored by the requester', async () => {
      const existing = { id: 'n1', contactId: 'c1', body: 'old', authorId: 'u1', authorName: 'Bob' };
      const updated = { ...existing, body: 'new' };
      mockPrisma.agentNote.findUnique.mockResolvedValue(existing);
      mockPrisma.agentNote.update.mockResolvedValue(updated);

      const result = await service.updateNote('c1', 'n1', { body: 'new' }, 'u1');
      expect(result.body).toBe('new');
    });

    it('throws BadRequestException when requester is not the author', async () => {
      const existing = { id: 'n1', contactId: 'c1', body: 'old', authorId: 'u1', authorName: 'Bob' };
      mockPrisma.agentNote.findUnique.mockResolvedValue(existing);

      await expect(service.updateNote('c1', 'n1', { body: 'new' }, 'other-user')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when note does not exist', async () => {
      mockPrisma.agentNote.findUnique.mockResolvedValue(null);

      await expect(service.updateNote('c1', 'missing', { body: 'new' }, 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteNote', () => {
    it('deletes a note authored by the requester', async () => {
      const existing = { id: 'n1', contactId: 'c1', body: 'hi', authorId: 'u1', authorName: 'Bob' };
      mockPrisma.agentNote.findUnique.mockResolvedValue(existing);
      mockPrisma.agentNote.delete.mockResolvedValue(existing);

      const result = await service.deleteNote('c1', 'n1', 'u1');
      expect(result).toEqual({ deleted: true });
    });

    it('throws BadRequestException when requester is not the author', async () => {
      const existing = { id: 'n1', contactId: 'c1', body: 'hi', authorId: 'u1', authorName: 'Bob' };
      mockPrisma.agentNote.findUnique.mockResolvedValue(existing);

      await expect(service.deleteNote('c1', 'n1', 'other')).rejects.toThrow(BadRequestException);
    });
  });

  // ----------------------------------------------------------------
  // Contact channels
  // ----------------------------------------------------------------

  describe('upsertChannel', () => {
    it('upserts a channel binding', async () => {
      const binding = { id: 'ch1', contactId: 'c1', channel: 'telegram', channelUserId: '@alice' };
      mockPrisma.contactChannel.upsert.mockResolvedValue(binding);

      const result = await service.upsertChannel('c1', {
        channel: 'telegram',
        channelUserId: '@alice',
      });
      expect(result).toEqual(binding);
    });
  });

  describe('removeChannel', () => {
    it('deletes an existing channel binding', async () => {
      const binding = { id: 'ch1', contactId: 'c1', channel: 'telegram', channelUserId: '@alice' };
      mockPrisma.contactChannel.findUnique.mockResolvedValue(binding);
      mockPrisma.contactChannel.delete.mockResolvedValue(binding);

      const result = await service.removeChannel('c1', 'telegram');
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when binding does not exist', async () => {
      mockPrisma.contactChannel.findUnique.mockResolvedValue(null);

      await expect(service.removeChannel('c1', 'telegram')).rejects.toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------------
  // Merge contacts
  // ----------------------------------------------------------------

  describe('mergeContacts', () => {
    it('throws BadRequestException when primaryId is in duplicateIds', async () => {
      await expect(
        service.mergeContacts({ primaryId: 'c1', duplicateIds: ['c1', 'c2'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('re-parents gateway records and deletes duplicates in ERP', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'c1' }) }) // verify primary
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) }) // delete c2
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) }); // delete c3

      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.mergeContacts({ primaryId: 'c1', duplicateIds: ['c2', 'c3'] });

      expect(result).toEqual({ primaryId: 'c1', merged: ['c2', 'c3'] });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
