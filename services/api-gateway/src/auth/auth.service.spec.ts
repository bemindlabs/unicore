import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { EmailService } from '../email/email.service';

jest.mock('bcryptjs');

const mockTokenBlacklistService = {
  blacklist: jest.fn().mockResolvedValue(undefined),
  isBlacklisted: jest.fn().mockResolvedValue(false),
};

const mockEmailService = {
  send: jest.fn().mockResolvedValue(true),
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  membership: {
    create: jest.fn(),
    upsert: jest.fn(),
  },
  oAuthAccount: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  verificationToken: {
    create: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: TokenBlacklistService, useValue: mockTokenBlacklistService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user data when credentials are valid', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        name: 'Test',
        role: 'VIEWER',
        password: 'hashed',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');
      expect(result).toEqual({
        id: '1',
        email: 'test@example.com',
        name: 'Test',
        role: 'VIEWER',
      });
    });

    it('should return null when user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('none@example.com', 'password');
      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        password: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrong');
      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    // Phase 5: /auth/register now mirrors signup — it creates the user's OWN
    // tenant + OWNER membership + activeTenantId via the shared onboarding helper.
    function mockOnboarding(tenantId = 'tenant-reg') {
      mockPrismaService.user.findUnique.mockResolvedValue(null); // no dup email
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.tenant.findUnique.mockResolvedValue(null); // slug free
      mockPrismaService.tenant.create.mockResolvedValue({ id: tenantId, slug: 'reg' });
      mockPrismaService.user.create.mockImplementation(async ({ data }: any) => ({
        id: '1',
        email: data.email,
        name: data.name,
        role: data.role,
        tenantId: data.tenantId,
        activeTenantId: data.activeTenantId,
      }));
      mockPrismaService.session.create.mockResolvedValue({});
    }

    it('should create a user and return tokens', async () => {
      mockOnboarding();

      const result = await service.register({
        email: 'new@example.com',
        name: 'New User',
        password: 'Password1',
        confirmPassword: 'Password1',
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('new@example.com');
    });

    it('creates the user OWN tenant + OWNER membership + activeTenantId', async () => {
      mockOnboarding('tenant-reg');

      await service.register({
        email: 'new@example.com',
        name: 'New User',
        password: 'Password1',
        confirmPassword: 'Password1',
      });

      expect(mockPrismaService.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
            plan: 'GROWTH',
            subscriptionStatus: 'TRIALING',
            trialEndsAt: expect.any(Date),
          }),
        }),
      );
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'OWNER',
            tenantId: 'tenant-reg',
            activeTenantId: 'tenant-reg',
            memberships: { create: { tenantId: 'tenant-reg', role: 'OWNER' } },
          }),
        }),
      );
      // tid claim carries the freshly-created owned tenant.
      const signedPayload = mockJwtService.sign.mock.calls[0][0];
      expect(signedPayload.tid).toBe('tenant-reg');
    });

    it('should throw ConflictException if email exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: '1' });

      await expect(
        service.register({
          email: 'exists@example.com',
          name: 'Test',
          password: 'Password1',
          confirmPassword: 'Password1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('validateOAuthUser (new user)', () => {
    it('creates a tenant + OWNER membership + activeTenantId for a brand-new OAuth user', async () => {
      mockPrismaService.oAuthAccount.findUnique.mockResolvedValue(null); // not linked
      mockPrismaService.user.findUnique.mockResolvedValue(null); // no user by email
      mockPrismaService.tenant.findUnique.mockResolvedValue(null); // slug free
      mockPrismaService.tenant.create.mockResolvedValue({ id: 'tenant-oauth', slug: 'jane' });
      mockPrismaService.user.create.mockImplementation(async ({ data }: any) => ({
        id: 'u-oauth',
        email: data.email,
        name: data.name,
        role: data.role,
        tenantId: data.tenantId,
        activeTenantId: data.activeTenantId,
      }));

      const result = await service.validateOAuthUser('google', {
        providerAccountId: 'g-123',
        email: 'jane@example.com',
        name: 'Jane',
        avatarUrl: null,
        accessToken: 'at',
        refreshToken: null,
      });

      expect(mockPrismaService.tenant.create).toHaveBeenCalled();
      const userCreateData = mockPrismaService.user.create.mock.calls[0][0].data;
      expect(userCreateData.role).toBe('OWNER');
      expect(userCreateData.memberships).toEqual({
        create: { tenantId: 'tenant-oauth', role: 'OWNER' },
      });
      // OAuth account is still nested-created alongside the membership.
      expect(userCreateData.oauthAccounts.create.provider).toBe('google');
      expect(result.activeTenantId).toBe('tenant-oauth');
    });
  });

  describe('tokenExchange', () => {
    const jose = require('jose');
    const verifySpy = jest.spyOn(jose, 'jwtVerify');

    beforeEach(() => {
      process.env.PLATFORM_JWT_SECRET = 'x'.repeat(40);
      verifySpy.mockResolvedValue({
        payload: { email: 'platform@example.com', name: 'Platform User' },
      } as any);
    });

    it('ensures a membership idempotently for an EXISTING user without creating a second tenant', async () => {
      // Existing user with a home tenant but NO membership yet.
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({
          id: 'u-exist',
          email: 'platform@example.com',
          name: 'Platform User',
          role: 'OWNER',
          tenantId: 'tenant-home',
          activeTenantId: null,
        })
        // second findUnique is inside ensureMembershipForExistingUser
        .mockResolvedValueOnce({
          id: 'u-exist',
          email: 'platform@example.com',
          name: 'Platform User',
          tenantId: 'tenant-home',
          activeTenantId: null,
          memberships: [],
        });
      mockPrismaService.membership.upsert.mockResolvedValue({});
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.session.create.mockResolvedValue({});

      const result = await service.tokenExchange('platform.jwt');

      // No new tenant created for an existing user.
      expect(mockPrismaService.tenant.create).not.toHaveBeenCalled();
      // Membership backfilled idempotently to the home tenant.
      expect(mockPrismaService.membership.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_tenantId: { userId: 'u-exist', tenantId: 'tenant-home' } },
          create: { userId: 'u-exist', tenantId: 'tenant-home', role: 'OWNER' },
        }),
      );
      const signedPayload = mockJwtService.sign.mock.calls[0][0];
      expect(signedPayload.tid).toBe('tenant-home');
      expect(result.user.email).toBe('platform@example.com');
    });

    it('provisions a tenant + OWNER membership for a brand-new platform user (no second user)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null); // user does not exist
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);
      mockPrismaService.tenant.create.mockResolvedValue({ id: 'tenant-new', slug: 'platform' });
      mockPrismaService.user.create.mockImplementation(async ({ data }: any) => ({
        id: 'u-new',
        email: data.email,
        name: data.name,
        role: data.role,
        tenantId: data.tenantId,
        activeTenantId: data.activeTenantId,
      }));
      mockPrismaService.session.create.mockResolvedValue({});

      const result = await service.tokenExchange('platform.jwt');

      expect(mockPrismaService.user.create).toHaveBeenCalledTimes(1);
      const userCreateData = mockPrismaService.user.create.mock.calls[0][0].data;
      expect(userCreateData.memberships).toEqual({
        create: { tenantId: 'tenant-new', role: 'OWNER' },
      });
      const signedPayload = mockJwtService.sign.mock.calls[0][0];
      expect(signedPayload.tid).toBe('tenant-new');
      expect(result.user.email).toBe('platform@example.com');
    });
  });

  describe('refresh', () => {
    it('should rotate tokens on valid refresh', async () => {
      const session = {
        id: 'session-1',
        refreshToken: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000),
        user: { id: '1', email: 'test@example.com', name: 'Test', role: 'VIEWER' },
      };
      mockPrismaService.session.findUnique.mockResolvedValue(session);
      mockPrismaService.session.delete.mockResolvedValue({});
      mockPrismaService.session.create.mockResolvedValue({});

      const result = await service.refresh('valid-token');
      expect(result.accessToken).toBeDefined();
      expect(mockPrismaService.session.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });

    it('should throw on invalid refresh token', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(service.refresh('invalid')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw on expired refresh token', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue({
        id: 'session-1',
        expiresAt: new Date(Date.now() - 86400000),
        user: { id: '1' },
      });
      mockPrismaService.session.delete.mockResolvedValue({});

      await expect(service.refresh('expired')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should delete session by refresh token', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout('token-to-invalidate');
      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { refreshToken: 'token-to-invalidate' },
      });
    });
  });

  describe('getMe', () => {
    it('should return user profile', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        name: 'Test',
        role: 'VIEWER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.getMe('1');
      expect(result).toEqual(user);
    });
  });
});
