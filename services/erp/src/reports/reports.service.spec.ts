import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService, isValidTimezone, toTzDate } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  contact: { count: jest.fn(), findMany: jest.fn() },
  order: { count: jest.fn() },
  product: { count: jest.fn(), findMany: jest.fn() },
  inventoryItem: { count: jest.fn(), findMany: jest.fn() },
  invoice: { count: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
  expense: { count: jest.fn(), groupBy: jest.fn(), aggregate: jest.fn() },
  orderItem: { groupBy: jest.fn() },
  $queryRaw: jest.fn(),
};

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  describe('isValidTimezone', () => {
    it('accepts UTC', () => {
      expect(isValidTimezone('UTC')).toBe(true);
    });

    it('accepts valid IANA timezone', () => {
      expect(isValidTimezone('Asia/Bangkok')).toBe(true);
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
    });

    it('rejects invalid timezone strings', () => {
      expect(isValidTimezone('NotATimezone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
      expect(isValidTimezone('Fake/Zone')).toBe(false);
    });

    it('rejects SQL injection attempts', () => {
      expect(isValidTimezone("'; DROP TABLE--")).toBe(false);
      expect(isValidTimezone('UTC; SELECT 1')).toBe(false);
    });
  });

  describe('toTzDate', () => {
    it('converts date string to UTC start-of-day in given timezone', () => {
      // Asia/Bangkok is UTC+7
      const result = toTzDate('2025-03-01', 'Asia/Bangkok');
      // 2025-03-01 00:00 Bangkok = 2025-02-28 17:00 UTC
      expect(result.toISOString()).toBe('2025-02-28T17:00:00.000Z');
    });

    it('returns same date for UTC timezone', () => {
      const result = toTzDate('2025-03-01', 'UTC');
      expect(result.toISOString()).toBe('2025-03-01T00:00:00.000Z');
    });

    it('handles negative offset timezone', () => {
      // America/New_York is UTC-5 (EST) or UTC-4 (EDT)
      // 2025-03-01 is in EST (UTC-5)
      const result = toTzDate('2025-03-01', 'America/New_York');
      expect(result.toISOString()).toBe('2025-03-01T05:00:00.000Z');
    });
  });

  describe('resolveTimezone', () => {
    const originalEnv = process.env.BUSINESS_TIMEZONE;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.BUSINESS_TIMEZONE;
      } else {
        process.env.BUSINESS_TIMEZONE = originalEnv;
      }
    });

    it('uses provided timezone when valid', () => {
      expect(service.resolveTimezone('Asia/Bangkok')).toBe('Asia/Bangkok');
    });

    it('falls back to BUSINESS_TIMEZONE env var', () => {
      process.env.BUSINESS_TIMEZONE = 'Europe/Berlin';
      expect(service.resolveTimezone(undefined)).toBe('Europe/Berlin');
    });

    it('falls back to UTC when env var is also missing', () => {
      delete process.env.BUSINESS_TIMEZONE;
      expect(service.resolveTimezone(undefined)).toBe('UTC');
    });

    it('ignores invalid provided timezone, uses env', () => {
      process.env.BUSINESS_TIMEZONE = 'Asia/Tokyo';
      expect(service.resolveTimezone('InvalidTz')).toBe('Asia/Tokyo');
    });
  });

  describe('getRevenueSummary', () => {
    it('passes timezone-adjusted dates to prisma query', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      await service.getRevenueSummary('2025-03-01', '2025-03-31', 'Asia/Bangkok');

      const call = mockPrisma.invoice.findMany.mock.calls[0][0];
      // from: 2025-03-01 00:00 Bangkok = 2025-02-28 17:00 UTC
      expect(call.where.paidAt.gte.toISOString()).toBe('2025-02-28T17:00:00.000Z');
      // to: end of 2025-03-31 Bangkok = 2025-03-31 16:59:59.999 UTC
      expect(call.where.paidAt.lte.getTime()).toBe(
        new Date('2025-03-31T17:00:00.000Z').getTime() - 1,
      );
    });

    it('includes timezone in response', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      const result = await service.getRevenueSummary(undefined, undefined, 'Asia/Bangkok');
      expect(result.timezone).toBe('Asia/Bangkok');
    });
  });

  describe('getMonthlyPnl', () => {
    it('passes timezone to raw SQL query', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getMonthlyPnl('Asia/Bangkok');

      expect(result.timezone).toBe('Asia/Bangkok');
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('defaults to UTC when no timezone provided', async () => {
      delete process.env.BUSINESS_TIMEZONE;
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getMonthlyPnl();

      expect(result.timezone).toBe('UTC');
    });
  });

  describe('getArAging', () => {
    it('passes timezone to raw SQL query', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getArAging('America/New_York');

      expect(result.timezone).toBe('America/New_York');
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });
});
