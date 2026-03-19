import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { RegisterDto } from './dto/register.dto';
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

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.recordFailedAttempt(email);
      this.logger.warn(`Login failed (bad password): ${email}`);
      return null;
    }

    this.loginAttempts.delete(email);
    return { id: user.id, email: user.email, name: user.name, role: user.role };
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

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { refreshToken } });
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

  private async createTokens(user: {
    id: string;
    email: string;
    name: string;
    role: string;
  }): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
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
