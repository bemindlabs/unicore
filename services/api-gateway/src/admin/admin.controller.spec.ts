import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TokenBlacklistService } from '../auth/token-blacklist.service';
import { LicenseService } from '../license/license.service';

describe('AdminController', () => {
  let controller: AdminController;

  const mockLicenseService = {
    hasFeature: jest.fn().mockResolvedValue(true),
    getLicenseStatus: jest.fn().mockResolvedValue({ tier: 'pro' }),
  };

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    session: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    chatHistory: {
      deleteMany: jest.fn(),
    },
    task: {
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockAuditService = { log: jest.fn() };
  const mockTokenBlacklist = { blacklist: jest.fn() };

  const currentUser = {
    id: 'owner-1',
    email: 'owner@test.com',
    role: 'OWNER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: TokenBlacklistService, useValue: mockTokenBlacklist },
        { provide: LicenseService, useValue: mockLicenseService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);

    // Reset all mocks between tests
    jest.clearAllMocks();
  });

  describe('listUsers', () => {
    it('returns all users ordered by createdAt desc', async () => {
      const users = [
        { id: 'u2', email: 'b@test.com', name: 'B', role: 'VIEWER', createdAt: new Date('2025-02-01') },
        { id: 'u1', email: 'a@test.com', name: 'A', role: 'OWNER', createdAt: new Date('2025-01-01') },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(users);

      const result = await controller.listUsers();

      expect(result).toEqual(users);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        select: { id: true, email: true, name: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateUserRole', () => {
    const targetUserId = 'user-2';

    it('successfully updates role and invalidates sessions', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'VIEWER' });
      mockPrismaService.user.update.mockResolvedValue({
        id: targetUserId,
        email: 'viewer@test.com',
        name: 'Viewer',
        role: 'OPERATOR',
      });

      // Create a fake JWT token with jti and exp
      const payload = { jti: 'token-jti-1', exp: Math.floor(Date.now() / 1000) + 3600 };
      const fakeToken = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
      mockPrismaService.session.findMany.mockResolvedValue([
        { id: 'sess-1', token: fakeToken },
      ]);
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 1 });

      const result = await controller.updateUserRole(targetUserId, 'OPERATOR', currentUser);

      expect(result).toEqual({
        id: targetUserId,
        email: 'viewer@test.com',
        name: 'Viewer',
        role: 'OPERATOR',
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: targetUserId },
        data: { role: 'OPERATOR' },
        select: { id: true, email: true, name: true, role: true },
      });
      expect(mockTokenBlacklist.blacklist).toHaveBeenCalledWith('token-jti-1', expect.any(Number));
      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({ where: { userId: targetUserId } });
    });

    it('rejects invalid role values', async () => {
      await expect(
        controller.updateUserRole(targetUserId, 'SUPERADMIN', currentUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks self-demotion', async () => {
      await expect(
        controller.updateUserRole(currentUser.id, 'VIEWER', currentUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.updateUserRole(currentUser.id, 'VIEWER', currentUser),
      ).rejects.toThrow('Cannot change your own role');
    });

    it('blocks demoting last OWNER', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'OWNER' });
      mockPrismaService.user.count.mockResolvedValue(1);

      await expect(
        controller.updateUserRole(targetUserId, 'VIEWER', currentUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.updateUserRole(targetUserId, 'VIEWER', currentUser),
      ).rejects.toThrow('Cannot demote the last owner account');
    });
  });

  describe('deleteUser', () => {
    const targetUserId = 'user-to-delete';
    const targetUser = { id: targetUserId, email: 'target@test.com', role: 'VIEWER' };

    it('successfully deletes user and cleans up related data', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);
      mockPrismaService.chatHistory.deleteMany.mockResolvedValue({ count: 5 });
      mockPrismaService.task.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.user.delete.mockResolvedValue(targetUser);
      mockAuditService.log.mockResolvedValue(undefined);

      await controller.deleteUser(targetUserId, currentUser);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: targetUserId },
        select: { id: true, email: true, role: true },
      });
      expect(mockPrismaService.chatHistory.deleteMany).toHaveBeenCalledWith({ where: { userId: targetUserId } });
      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { assigneeId: targetUserId },
        data: { assigneeId: null, assigneeName: null, assigneeType: null, assigneeColor: null },
      });
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({ where: { id: targetUserId } });
    });

    it('returns undefined (204 No Content)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);
      mockPrismaService.chatHistory.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.task.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.user.delete.mockResolvedValue(targetUser);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await controller.deleteUser(targetUserId, currentUser);

      // @HttpCode(HttpStatus.NO_CONTENT) means the method returns void/undefined
      expect(result).toBeUndefined();
    });

    it('blocks self-deletion', async () => {
      await expect(
        controller.deleteUser(currentUser.id, currentUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.deleteUser(currentUser.id, currentUser),
      ).rejects.toThrow('Cannot delete your own account');
    });

    it('blocks deleting last OWNER', async () => {
      const ownerTarget = { id: 'other-owner', email: 'other@test.com', role: 'OWNER' };
      mockPrismaService.user.findUnique.mockResolvedValue(ownerTarget);
      mockPrismaService.user.count.mockResolvedValue(1);

      await expect(
        controller.deleteUser('other-owner', currentUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.deleteUser('other-owner', currentUser),
      ).rejects.toThrow('Cannot delete the last owner account');
    });

    it('throws NotFoundException for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        controller.deleteUser('non-existent-id', currentUser),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.deleteUser('non-existent-id', currentUser),
      ).rejects.toThrow('User not found');
    });

    it('cleans up ChatHistory records', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);
      mockPrismaService.chatHistory.deleteMany.mockResolvedValue({ count: 10 });
      mockPrismaService.task.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.user.delete.mockResolvedValue(targetUser);
      mockAuditService.log.mockResolvedValue(undefined);

      await controller.deleteUser(targetUserId, currentUser);

      expect(mockPrismaService.chatHistory.deleteMany).toHaveBeenCalledWith({
        where: { userId: targetUserId },
      });
    });

    it('nullifies Task assignee fields', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);
      mockPrismaService.chatHistory.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.task.updateMany.mockResolvedValue({ count: 3 });
      mockPrismaService.user.delete.mockResolvedValue(targetUser);
      mockAuditService.log.mockResolvedValue(undefined);

      await controller.deleteUser(targetUserId, currentUser);

      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { assigneeId: targetUserId },
        data: { assigneeId: null, assigneeName: null, assigneeType: null, assigneeColor: null },
      });
    });

    it('logs audit entry', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);
      mockPrismaService.chatHistory.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.task.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.user.delete.mockResolvedValue(targetUser);
      mockAuditService.log.mockResolvedValue(undefined);

      await controller.deleteUser(targetUserId, currentUser);

      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId: currentUser.id,
        userEmail: currentUser.email,
        action: 'delete',
        resource: 'users',
        resourceId: targetUserId,
        detail: `Deleted user ${targetUser.email}`,
      });
    });

    it('sessions cascade automatically (no explicit session delete in delete method)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);
      mockPrismaService.chatHistory.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.task.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.user.delete.mockResolvedValue(targetUser);
      mockAuditService.log.mockResolvedValue(undefined);

      await controller.deleteUser(targetUserId, currentUser);

      // The deleteUser method does NOT explicitly delete sessions;
      // Prisma handles session cleanup via onDelete: Cascade on the User relation
      expect(mockPrismaService.session.deleteMany).not.toHaveBeenCalled();
    });
  });
});
