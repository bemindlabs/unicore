import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DemoModeGuard } from './demo-mode.guard';
import { AuditService } from '../../audit/audit.service';

describe('DemoModeGuard', () => {
  function createMockContext(
    method: string,
    user?: { id?: string; email?: string; role?: string },
    path = '/api/v1/settings',
  ): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ method, user, path }),
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;
  }

  function createMockAuditService(): AuditService {
    return { log: jest.fn().mockResolvedValue(undefined) } as any;
  }

  describe('when DEMO_MODE is not set', () => {
    let guard: DemoModeGuard;

    beforeEach(() => {
      delete process.env.DEMO_MODE;
      guard = new DemoModeGuard();
    });

    it('should allow GET requests', () => {
      expect(guard.canActivate(createMockContext('GET'))).toBe(true);
    });

    it('should allow POST requests', () => {
      expect(guard.canActivate(createMockContext('POST'))).toBe(true);
    });

    it('should allow PUT requests', () => {
      expect(guard.canActivate(createMockContext('PUT'))).toBe(true);
    });

    it('should allow DELETE requests', () => {
      expect(guard.canActivate(createMockContext('DELETE'))).toBe(true);
    });

    it('should allow requests without a user', () => {
      expect(guard.canActivate(createMockContext('POST', undefined))).toBe(true);
    });
  });

  describe('when DEMO_MODE is true', () => {
    let guard: DemoModeGuard;
    let auditService: AuditService;

    beforeEach(() => {
      process.env.DEMO_MODE = 'true';
      auditService = createMockAuditService();
      guard = new DemoModeGuard(auditService);
    });

    afterEach(() => {
      delete process.env.DEMO_MODE;
    });

    it('should allow GET requests', () => {
      const ctx = createMockContext('GET', { role: 'VIEWER' });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should allow HEAD requests', () => {
      const ctx = createMockContext('HEAD', { role: 'VIEWER' });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should allow OPTIONS requests', () => {
      const ctx = createMockContext('OPTIONS', { role: 'VIEWER' });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should allow OWNER to perform POST requests', () => {
      const ctx = createMockContext('POST', { id: '1', email: 'owner@test.com', role: 'OWNER' });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should allow OWNER to perform PUT requests', () => {
      const ctx = createMockContext('PUT', { id: '1', email: 'owner@test.com', role: 'OWNER' });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should allow OWNER to perform DELETE requests', () => {
      const ctx = createMockContext('DELETE', { id: '1', email: 'owner@test.com', role: 'OWNER' });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should block non-OWNER POST requests', () => {
      const ctx = createMockContext('POST', { id: '2', email: 'viewer@test.com', role: 'VIEWER' });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(ctx)).toThrow('This action is not available in demo mode');
    });

    it('should block non-OWNER PUT requests', () => {
      const ctx = createMockContext('PUT', { id: '2', email: 'op@test.com', role: 'OPERATOR' });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should block non-OWNER PATCH requests', () => {
      const ctx = createMockContext('PATCH', { id: '2', email: 'mk@test.com', role: 'MARKETER' });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should block non-OWNER DELETE requests', () => {
      const ctx = createMockContext('DELETE', { id: '2', email: 'fin@test.com', role: 'FINANCE' });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should block anonymous write requests', () => {
      const ctx = createMockContext('POST', undefined);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should log blocked attempts via AuditService', () => {
      const ctx = createMockContext('POST', { id: '2', email: 'viewer@test.com', role: 'VIEWER' }, '/api/v1/settings');
      try { guard.canActivate(ctx); } catch {}

      expect(auditService.log).toHaveBeenCalledWith({
        userId: '2',
        userEmail: 'viewer@test.com',
        action: 'demo_blocked',
        resource: '/api/v1/settings',
        detail: 'Demo mode blocked POST /api/v1/settings by viewer@test.com',
        success: false,
      });
    });

    it('should log blocked anonymous attempts', () => {
      const ctx = createMockContext('DELETE', undefined, '/api/v1/users/1');
      try { guard.canActivate(ctx); } catch {}

      expect(auditService.log).toHaveBeenCalledWith({
        userId: undefined,
        userEmail: undefined,
        action: 'demo_blocked',
        resource: '/api/v1/users/1',
        detail: 'Demo mode blocked DELETE /api/v1/users/1 by anonymous',
        success: false,
      });
    });
  });

  describe('when DEMO_MODE is false', () => {
    it('should allow all requests', () => {
      process.env.DEMO_MODE = 'false';
      const guard = new DemoModeGuard();
      expect(guard.canActivate(createMockContext('DELETE', { role: 'VIEWER' }))).toBe(true);
      delete process.env.DEMO_MODE;
    });
  });
});
