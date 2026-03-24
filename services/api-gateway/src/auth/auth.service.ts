import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { jwtVerify } from 'jose';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponseDto } from './dto/auth-response.dto';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

interface LoginAttemptRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private readonly loginAttempts = new Map<string, LoginAttemptRecord>();
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {
    this.cleanupTimer = setInterval(() => this.purgeExpiredAttempts(), 10 * 60 * 1000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }

  private purgeExpiredAttempts(): void {
    const now = Date.now();
    for (const [email, record] of this.loginAttempts) {
      if (
        now - record.firstAttemptAt > LOCKOUT_WINDOW_MS ||
        (record.lockedUntil !== null && now > record.lockedUntil)
      ) {
        this.loginAttempts.delete(email);
      }
    }
  }

  private isLockedOut(email: string): boolean {
    const record = this.loginAttempts.get(email);
    if (!record) return false;
    if (record.lockedUntil !== null && Date.now() > record.lockedUntil) {
      this.loginAttempts.delete(email);
      return false;
    }
    if (record.lockedUntil === null && Date.now() - record.firstAttemptAt > LOCKOUT_WINDOW_MS) {
      this.loginAttempts.delete(email);
      return false;
    }
    return record.lockedUntil !== null;
  }

  private recordFailedAttempt(email: string): void {
    const now = Date.now();
    const record = this.loginAttempts.get(email);
    if (!record || now - record.firstAttemptAt > LOCKOUT_WINDOW_MS) {
      this.loginAttempts.set(email, { attempts: 1, firstAttemptAt: now, lockedUntil: null });
      return;
    }
    record.attempts += 1;
    if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_WINDOW_MS;
      this.logger.warn(`Account locked after ${record.attempts} failed attempts: ${email}`);
    }
  }

  async validateUser(email: string, password: string) {
    if (this.isLockedOut(email)) {
      this.logger.warn(`Login attempt on locked account: ${email}`);
      return null;
    }

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      this.recordFailedAttempt(email);
      this.logger.warn(`Login failed (unknown email): ${email}`);
      return null;
    }

    // OAuth-only accounts have no password — reject password login
    if (!user.password) {
      this.logger.warn(`Password login rejected for OAuth-only account: ${email}`);
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.recordFailedAttempt(email);
      this.logger.warn(`Login failed (bad password): ${email}`);
      return null;
    }

    this.loginAttempts.delete(email);
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  // ---------------------------------------------------------------------------
  // OAuth
  // ---------------------------------------------------------------------------

  async validateOAuthUser(
    provider: string,
    profile: {
      providerAccountId: string;
      email: string | null;
      name: string;
      avatarUrl: string | null;
      accessToken: string;
      refreshToken: string | null;
    },
  ): Promise<{ id: string; email: string; name: string; role: string }> {
    // 1. Check if this OAuth account is already linked
    const existing = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
      },
    });

    if (existing) {
      // Update tokens on the OAuth account
      await this.prisma.oAuthAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        },
      });
      this.logger.log(`OAuth login (${provider}): ${existing.user.email}`);
      return existing.user;
    }

    // 2. If we have an email, check if a user with that email exists
    if (profile.email) {
      const userByEmail = await this.prisma.user.findUnique({
        where: { email: profile.email },
        select: { id: true, email: true, name: true, role: true },
      });

      if (userByEmail) {
        // Link OAuth account to existing user
        await this.linkOAuthAccount(userByEmail.id, provider, profile);
        this.logger.log(
          `OAuth account linked (${provider}): ${userByEmail.email}`,
        );
        return userByEmail;
      }
    }

    // 3. Create a new user + OAuth account (no password)
    const email = profile.email || `${provider}-${profile.providerAccountId}@oauth.local`;
    const user = await this.prisma.user.create({
      data: {
        email,
        name: profile.name,
        password: null,
        oauthAccounts: {
          create: {
            provider,
            providerAccountId: profile.providerAccountId,
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken,
          },
        },
      },
      select: { id: true, email: true, name: true, role: true },
    });

    this.logger.log(`New OAuth user registered (${provider}): ${user.email}`);
    return user;
  }

  async linkOAuthAccount(
    userId: string,
    provider: string,
    profile: {
      providerAccountId: string;
      email: string | null;
      name: string;
      avatarUrl: string | null;
      accessToken: string;
      refreshToken: string | null;
    },
  ): Promise<void> {
    await this.prisma.oAuthAccount.create({
      data: {
        userId,
        provider,
        providerAccountId: profile.providerAccountId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
      },
    });
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    this.logger.log(`User registered: ${user.email}`);

    return this.createTokens(user);
  }

  async provisionAdmin(
    email: string,
    name: string,
    password: string,
    role: 'OWNER' | 'OPERATOR' = 'OWNER',
  ): Promise<{ id: string; email: string; name: string; role: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      // Update existing user to the requested role
      const updated = await this.prisma.user.update({
        where: { email },
        data: { role },
        select: { id: true, email: true, name: true, role: true },
      });
      this.logger.log(`Admin user updated: ${updated.email} → ${role}`);
      return updated;
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: { email, name, password: hashedPassword, role },
      select: { id: true, email: true, name: true, role: true },
    });

    this.logger.log(`Admin user provisioned: ${user.email} (${role})`);
    return user;
  }

  async login(user: {
    id: string;
    email: string;
    name: string;
    role: string;
  }): Promise<AuthResponseDto> {
    this.logger.log(`User logged in: ${user.email}`);
    return this.createTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Delete old session (token rotation)
    await this.prisma.session.delete({ where: { id: session.id } });

    return this.createTokens(session.user);
  }

  async logout(refreshToken: string, accessToken?: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { refreshToken } });

    // Blacklist the access token in Redis so it cannot be reused until expiry
    if (accessToken) {
      try {
        const decoded = this.jwtService.decode(accessToken) as JwtPayload | null;
        if (decoded?.jti) {
          const now = Math.floor(Date.now() / 1000);
          const ttl = decoded.exp ? decoded.exp - now : 900; // fallback 15m
          if (ttl > 0) {
            await this.tokenBlacklist.blacklist(decoded.jti, ttl);
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to blacklist access token: ${(err as Error).message}`);
      }
    }

    this.logger.log('Session invalidated');
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Record<string, string> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) {
      // Check if email is already taken by another user
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email already in use');
      }
      data.email = dto.email;
    }

    if (Object.keys(data).length === 0) {
      return this.getMe(userId);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Profile updated: ${updated.email}`);
    return updated;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'This account uses OAuth login. Set a password first via your profile settings.',
      );
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    this.logger.log(`Password changed: ${user.email}`);
    return { message: 'Password changed successfully' };
  }

  // ---------------------------------------------------------------------------
  // Cross-domain Token Exchange
  // ---------------------------------------------------------------------------

  async tokenExchange(
    platformToken: string,
    targetApp?: string,
  ): Promise<AuthResponseDto> {
    const platformSecret =
      process.env.PLATFORM_JWT_SECRET || process.env.JWT_SECRET;

    if (!platformSecret) {
      this.logger.error('Token exchange failed: no PLATFORM_JWT_SECRET or JWT_SECRET configured');
      throw new UnauthorizedException('Token exchange is not configured');
    }

    // 1. Verify the platform JWT
    let payload: { customerId?: string; email?: string; name?: string; sub?: string };
    try {
      const secret = new TextEncoder().encode(platformSecret);
      const { payload: verified } = await jwtVerify(platformToken, secret);
      payload = verified as typeof payload;
    } catch (err) {
      this.logger.warn(
        `Token exchange failed: invalid platform token — ${(err as Error).message}`,
      );
      throw new UnauthorizedException('Invalid or expired platform token');
    }

    const email = payload.email;
    if (!email) {
      throw new UnauthorizedException('Platform token missing email claim');
    }

    const customerName = payload.name || 'Platform User';

    // 2. Find or create user in API Gateway database
    let user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: customerName,
          password: null, // Platform-linked account, no local password
        },
        select: { id: true, email: true, name: true, role: true },
      });
      this.logger.log(`Platform-linked user created via token exchange: ${email}`);
    }

    // 3. Generate API Gateway tokens
    const tokens = await this.createTokens(user);

    this.logger.log(
      `Token exchange successful: ${email}${targetApp ? ` → ${targetApp}` : ''}`,
    );

    return tokens;
  }

  private async createTokens(user: {
    id: string;
    email: string;
    name: string;
    role: string;
  }): Promise<AuthResponseDto> {
    const jti = randomBytes(16).toString('hex');
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = randomBytes(40).toString('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        refreshToken,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}
