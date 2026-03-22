import { Test, TestingModule } from '@nestjs/testing';
import { WizardStatusService } from './wizard-status.service';

describe('WizardStatusService', () => {
  let service: WizardStatusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WizardStatusService],
    }).compile();

    service = module.get<WizardStatusService>(WizardStatusService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('initial state', () => {
    it('isComplete returns false before markComplete is called', () => {
      expect(service.isComplete()).toBe(false);
    });

    it('getStatus returns completed=false initially', () => {
      expect(service.getStatus().completed).toBe(false);
    });

    it('getStatus does not include completedAt when not yet complete', () => {
      expect(service.getStatus()).not.toHaveProperty('completedAt');
    });
  });

  describe('markComplete', () => {
    it('sets isComplete to true after markComplete', () => {
      service.markComplete();
      expect(service.isComplete()).toBe(true);
    });

    it('getStatus returns completed=true after markComplete', () => {
      service.markComplete();
      expect(service.getStatus().completed).toBe(true);
    });

    it('getStatus includes completedAt ISO string after markComplete', () => {
      const before = new Date();
      service.markComplete();
      const status = service.getStatus();
      expect(status.completedAt).toBeDefined();
      const completedAt = new Date(status.completedAt!);
      expect(completedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('is idempotent — calling markComplete twice does not throw', () => {
      expect(() => {
        service.markComplete();
        service.markComplete();
      }).not.toThrow();
    });

    it('retains first completedAt when called multiple times', () => {
      service.markComplete();
      const firstStatus = service.getStatus();
      service.markComplete();
      const secondStatus = service.getStatus();
      expect(secondStatus.completedAt).toBe(firstStatus.completedAt);
    });

    it('remains complete after repeated markComplete calls', () => {
      service.markComplete();
      service.markComplete();
      expect(service.isComplete()).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('returns a plain object with completed boolean', () => {
      const status = service.getStatus();
      expect(typeof status.completed).toBe('boolean');
    });

    it('returns completed=true and completedAt after markComplete', () => {
      service.markComplete();
      const status = service.getStatus();
      expect(status).toMatchObject({ completed: true });
      expect(status.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('completedAt is a valid ISO 8601 date string', () => {
      service.markComplete();
      const { completedAt } = service.getStatus();
      expect(completedAt).toBeDefined();
      expect(() => new Date(completedAt!).toISOString()).not.toThrow();
    });
  });
});
