import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

/**
 * GAPS #8 — password reset + email verification flows.
 *
 * Asserts: forgot→reset issues a single-use token, reset revokes sessions and
 * consumes outstanding reset tokens; verify-email stamps emailVerified; and
 * forgot-password never enumerates users (always the same 200 response, no email
 * sent for unknown / OAuth-only accounts).
 */
describe('AuthService password reset + email verification', () => {
  afterEach(() => jest.clearAllMocks());

  function build(opts: { user?: any; token?: any } = {}) {
    const tokens: any[] = [];
    const prisma = {
      user: {
        findUnique: jest.fn(async () => opts.user ?? null),
        update: jest.fn(async () => ({})),
      },
      session: { deleteMany: jest.fn(async () => ({ count: 2 })) },
      verificationToken: {
        create: jest.fn(async ({ data }: any) => {
          const row = { id: `tok-${tokens.length}`, consumedAt: null, ...data };
          tokens.push(row);
          return row;
        }),
        findUnique: jest.fn(async () => opts.token ?? null),
        update: jest.fn(async () => ({})),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      // Run transaction operations as-is (each element is a lazy promise here).
      $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
    };
    const email = { send: jest.fn(async () => true) };
    const service = new AuthService(
      prisma as any,
      { sign: jest.fn() } as any,
      {} as any,
      email as any,
    );
    service.onModuleDestroy();
    return { service, prisma, email, tokens };
  }

  describe('forgotPassword (no user enumeration)', () => {
    it('returns the generic 200 message and sends an email for a known password user', async () => {
      const { service, email } = build({
        user: { id: 'u1', email: 'a@b.com', name: 'A', password: 'hash' },
      });
      const res = await service.forgotPassword('a@b.com');
      expect(res.message).toMatch(/if an account exists/i);
      expect(email.send).toHaveBeenCalledTimes(1);
    });

    it('returns the SAME message but sends NO email for an unknown email', async () => {
      const { service, email } = build({ user: null });
      const res = await service.forgotPassword('nobody@nowhere.com');
      expect(res.message).toMatch(/if an account exists/i);
      expect(email.send).not.toHaveBeenCalled();
    });

    it('sends no email for an OAuth-only account (no password)', async () => {
      const { service, email } = build({
        user: { id: 'u2', email: 'oauth@b.com', name: 'O', password: null },
      });
      await service.forgotPassword('oauth@b.com');
      expect(email.send).not.toHaveBeenCalled();
    });

    it('rate-limits repeated requests for the same email (no email after the cap)', async () => {
      const { service, email } = build({
        user: { id: 'u1', email: 'a@b.com', name: 'A', password: 'hash' },
      });
      for (let i = 0; i < 5; i++) await service.forgotPassword('a@b.com');
      // FORGOT_MAX_PER_WINDOW = 3 → at most 3 emails in the window.
      expect(email.send.mock.calls.length).toBeLessThanOrEqual(3);
    });
  });

  describe('resetPassword (single-use token, sessions revoked)', () => {
    it('sets the password, consumes the token, and revokes sessions', async () => {
      const validToken = {
        id: 'tok-1',
        userId: 'u1',
        type: 'PASSWORD_RESET',
        consumedAt: null,
        expiresAt: new Date(Date.now() + 3_600_000),
      };
      const { service, prisma } = build({ token: validToken });
      const res = await service.resetPassword('raw-token', 'NewPass1');
      expect(res.message).toMatch(/reset/i);
      // Password is stored as a real bcrypt hash (not the plaintext).
      const updateArg = prisma.user.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: 'u1' });
      expect(typeof updateArg.data.password).toBe('string');
      expect(updateArg.data.password).not.toBe('NewPass1');
      expect(bcrypt.compareSync('NewPass1', updateArg.data.password)).toBe(true);
      expect(prisma.verificationToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'u1', type: 'PASSWORD_RESET', consumedAt: null }),
        }),
      );
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('rejects an already-consumed token (single-use)', async () => {
      const consumed = {
        id: 'tok-1',
        userId: 'u1',
        type: 'PASSWORD_RESET',
        consumedAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
      };
      const { service } = build({ token: consumed });
      await expect(service.resetPassword('raw', 'NewPass1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an expired token', async () => {
      const expired = {
        id: 'tok-1',
        userId: 'u1',
        type: 'PASSWORD_RESET',
        consumedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      };
      const { service } = build({ token: expired });
      await expect(service.resetPassword('raw', 'NewPass1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a token of the wrong type (verify token used for reset)', async () => {
      const wrongType = {
        id: 'tok-1',
        userId: 'u1',
        type: 'EMAIL_VERIFY',
        consumedAt: null,
        expiresAt: new Date(Date.now() + 3_600_000),
      };
      const { service } = build({ token: wrongType });
      await expect(service.resetPassword('raw', 'NewPass1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('verifyEmail', () => {
    it('stamps emailVerified and consumes the token', async () => {
      const validToken = {
        id: 'tok-1',
        userId: 'u1',
        type: 'EMAIL_VERIFY',
        consumedAt: null,
        expiresAt: new Date(Date.now() + 3_600_000),
      };
      const { service, prisma } = build({ token: validToken });
      const res = await service.verifyEmail('raw');
      expect(res.message).toMatch(/verified/i);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: { emailVerified: expect.any(Date) },
        }),
      );
      expect(prisma.verificationToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tok-1' }, data: { consumedAt: expect.any(Date) } }),
      );
    });

    it('rejects an invalid/unknown token', async () => {
      const { service } = build({ token: null });
      await expect(service.verifyEmail('nope')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
