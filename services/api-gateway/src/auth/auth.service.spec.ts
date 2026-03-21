import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlacklistService } from './token-blacklist.service';

jest.mock('bcryptjs');

const mockTokenBlacklistService = {
  blacklist: jest.fn().mockResolvedValue(undefined),
  isBlacklisted: jest.fn().mockResolvedValue(false),
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
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
    it('should create a user and return tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue({
        id: '1',
        email: 'new@example.com',
        name: 'New User',
        role: 'VIEWER',
      });
      mockPrismaService.session.create.mockResolvedValue({});

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
