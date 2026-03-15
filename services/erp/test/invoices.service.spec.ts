import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from '../src/invoices/invoices.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { EventPublisherService } from '../src/kafka/event-publisher.service';

const mockPublisher = {
  publish: jest.fn().mockResolvedValue(undefined),
};

const mockPrisma = {
  invoice: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  payment: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('InvoicesService', () => {
  let service: InvoicesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventPublisherService, useValue: mockPublisher },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne()', () => {
    it('throws NotFoundException when invoice not found', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow('not found');
    });
  });
});
