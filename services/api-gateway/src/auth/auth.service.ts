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
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { EmailService } from '../email/email.service';
import {
  verifyEmailHtml,
  resetPasswordEmailHtml,
} from '../email/templates/auth-emails';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponseDto } from './dto/auth-response.dto';
import { DEMO_TENANT_ID } from '../common/tenancy/tenancy.config';
import { SignupDto } from './dto/signup.dto';
import { TRIAL_PLAN, computeTrialEnd, PLANS } from '../common/tenancy/plans.config';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

/** Token types for the VerificationToken table. */
const TOKEN_TYPE = {
  PASSWORD_RESET: 'PASSWORD_RESET',
  EMAIL_VERIFY: 'EMAIL_VERIFY',
} as const;

/** Password-reset token lifetime. */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
/** Email-verification token lifetime. */
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/** forgot-password per-email rate limit (anti-abuse, anti-enumeration timing). */
const FORGOT_MAX_PER_WINDOW = 3;
const FORGOT_WINDOW_MS = 15 * 60 * 1000;

interface LoginAttemptRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

interface RateRecord {
  count: number;
  windowStart: number;
}

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private readonly loginAttempts = new Map<string, LoginAttemptRecord>();
  /** Per-email forgot-password rate-limit buckets (in-memory, like loginAttempts). */
  private readonly forgotAttempts = new Map<string, RateRecord>();
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklist: TokenBlacklistService,
    private readonly email: EmailService,
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
    for (const [email, record] of this.forgotAttempts) {
      if (now - record.windowStart > FORGOT_WINDOW_MS) {
        this.forgotAttempts.delete(email);
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
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      activeTenantId: user.activeTenantId,
    };
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
  ): Promise<{
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId?: string | null;
    activeTenantId?: string | null;
  }> {
    // 1. Check if this OAuth account is already linked
    const existing = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            tenantId: true,
            activeTenantId: true,
          },
        },
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
      // Idempotent backfill: a legacy OAuth user with no membership gets one (and
      // a sensible activeTenantId) without creating a duplicate tenant.
      const { tenantId, activeTenantId } = await this.ensureMembershipForExistingUser(
        existing.user.id,
      );
      return { ...existing.user, tenantId, activeTenantId };
    }

    // 2. If we have an email, check if a user with that email exists
    if (profile.email) {
      const userByEmail = await this.prisma.user.findUnique({
        where: { email: profile.email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
          activeTenantId: true,
        },
      });

      if (userByEmail) {
        // Link OAuth account to existing user
        await this.linkOAuthAccount(userByEmail.id, provider, profile);
        this.logger.log(
          `OAuth account linked (${provider}): ${userByEmail.email}`,
        );
        // Ensure the existing user has a membership + active tenant (idempotent).
        const { tenantId, activeTenantId } = await this.ensureMembershipForExistingUser(
          userByEmail.id,
        );
        return { ...userByEmail, tenantId, activeTenantId };
      }
    }

    // 3. Create a new user + OAuth account (no password). Like signup, a brand-new
    // OAuth user also gets their OWN Tenant + OWNER Membership + activeTenantId via
    // the shared onboarding primitive (Phase 5) — no more zero-membership users.
    const email = profile.email || `${provider}-${profile.providerAccountId}@oauth.local`;
    const { user } = await this.createUserOwnedTenant({
      email,
      name: profile.name,
      password: null,
      logContext: `New OAuth user (${provider})`,
      extraUserData: {
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
    });

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

    // Public registration creates a real multi-tenant onboarding shape, mirroring
    // self-serve signup: the user's OWN Tenant + OWNER Membership + activeTenantId
    // via the shared onboarding primitive (Phase 5). No more zero-membership users
    // landing in the demo tenant. (Bootstrap/admin provisioning uses
    // provisionAdmin, which is a separate, secret-gated path.)
    const { user } = await this.createUserOwnedTenant({
      email: dto.email,
      name: dto.name,
      password: hashedPassword,
      logContext: 'User registered',
    });

    return this.createTokens(user);
  }

  /**
   * Self-serve SaaS signup (M3/E3). Creates a Tenant (status ACTIVE,
   * subscriptionStatus TRIALING, plan = full-Growth trial) + an OWNER User, sets
   * the 30-day trial window, then logs the user in. NO Stripe call here — the
   * card is collected later at conversion.
   */
  async signup(dto: SignupDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Signup creates the user + first tenant + OWNER Membership and selects that
    // tenant as the active one (Phase 5 / W1a). The tenant+OWNER+membership work
    // is shared with the OAuth-new-user and /auth/register paths so all three
    // produce an identical onboarding shape.
    const { user } = await this.createUserOwnedTenant({
      email: dto.email,
      name: dto.name,
      password: hashedPassword,
      businessName: dto.businessName,
      logContext: 'SaaS signup',
    });

    return this.createTokens(user);
  }

  /**
   * Shared onboarding primitive (Phase 5): create a brand-new user's OWN Tenant
   * (ACTIVE, TRIALING, full-Growth trial defaults), an OWNER Membership, and set
   * the user's home + active tenant to it. Reused by signup, OAuth new-user, and
   * /auth/register so the three paths never drift. The caller decides whether the
   * user has a password (null for OAuth) and may supply the OAuth account create.
   */
  private async createUserOwnedTenant(params: {
    email: string;
    name: string;
    password: string | null;
    businessName?: string | null;
    /** Extra nested writes merged into the user.create data (e.g. oauthAccounts). */
    extraUserData?: Record<string, unknown>;
    logContext: string;
  }): Promise<{
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      tenantId: string | null;
      activeTenantId: string | null;
    };
    tenant: { id: string; slug: string };
  }> {
    const businessName = (params.businessName || params.name).trim();
    const slug = await this.generateUniqueSlug(businessName || params.email.split('@')[0]);
    const trialEndsAt = computeTrialEnd();

    // Trial gives the full Growth feature set; the tenant.plan reflects that.
    const tenant = await this.prisma.tenant.create({
      data: {
        slug,
        name: businessName || params.email.split('@')[0],
        status: 'ACTIVE',
        plan: PLANS[TRIAL_PLAN].key,
        subscriptionStatus: 'TRIALING',
        trialEndsAt,
      },
    });

    const user = await this.prisma.user.create({
      data: {
        email: params.email,
        name: params.name,
        password: params.password,
        role: 'OWNER',
        tenantId: tenant.id,
        activeTenantId: tenant.id,
        memberships: {
          create: { tenantId: tenant.id, role: 'OWNER' },
        },
        ...(params.extraUserData ?? {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        activeTenantId: true,
      },
    });

    this.logger.log(
      `${params.logContext}: tenant ${tenant.id} (${slug}) + OWNER ${user.email}, trial ends ${trialEndsAt.toISOString()}`,
    );

    // GAPS #8: send an email-verification link for password-based signups
    // (register/signup). OAuth/platform-linked users (no password) are
    // considered email-verified by their provider, so skip.
    if (params.password) {
      await this.sendVerificationEmail(user.id, user.email, user.name);
    }

    return { user, tenant };
  }

  // ---------------------------------------------------------------------------
  // Email verification + password reset (GAPS #8)
  // Tokens are single-use, time-limited, and stored HASHED (sha256). The raw
  // token only ever travels in the emailed link. Identity-level / tenant-agnostic.
  // ---------------------------------------------------------------------------

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Mint a raw token + persist its hash with a type + expiry. Returns the raw. */
  private async createVerificationToken(
    userId: string,
    type: string,
    ttlMs: number,
  ): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    await this.prisma.verificationToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(raw),
        type,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return raw;
  }

  /** Create + email an email-verification link. Best-effort (logged no-op without Resend). */
  async sendVerificationEmail(userId: string, email: string, name: string): Promise<void> {
    const raw = await this.createVerificationToken(
      userId,
      TOKEN_TYPE.EMAIL_VERIFY,
      VERIFY_TOKEN_TTL_MS,
    );
    const base = process.env.DASHBOARD_URL || 'http://localhost:3000';
    const verifyUrl = `${base}/auth/verify-email?token=${raw}`;
    await this.email.send({
      to: email,
      subject: 'Verify your UniCore email',
      html: verifyEmailHtml({ name, verifyUrl }),
    });
    this.logger.log(`Email-verification link issued for ${email}`);
  }

  private isForgotRateLimited(email: string): boolean {
    const now = Date.now();
    const rec = this.forgotAttempts.get(email);
    if (!rec || now - rec.windowStart > FORGOT_WINDOW_MS) {
      this.forgotAttempts.set(email, { count: 1, windowStart: now });
      return false;
    }
    rec.count += 1;
    return rec.count > FORGOT_MAX_PER_WINDOW;
  }

  /**
   * GAPS #8 — forgot-password. ALWAYS resolves the same way (no user
   * enumeration): if the email maps to a password account, mint a reset token
   * and email it; otherwise do nothing. Rate-limited per email.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const genericOk = {
      message: 'If an account exists for that email, a reset link has been sent.',
    };

    if (this.isForgotRateLimited(email)) {
      this.logger.warn(`forgot-password rate-limited: ${email}`);
      return genericOk;
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    // Only password accounts can reset a password; OAuth-only accounts have none.
    if (!user || !user.password) {
      return genericOk;
    }

    const raw = await this.createVerificationToken(
      user.id,
      TOKEN_TYPE.PASSWORD_RESET,
      RESET_TOKEN_TTL_MS,
    );
    const base = process.env.DASHBOARD_URL || 'http://localhost:3000';
    const resetUrl = `${base}/auth/reset-password?token=${raw}`;
    await this.email.send({
      to: user.email,
      subject: 'Reset your UniCore password',
      html: resetPasswordEmailHtml({
        name: user.name,
        resetUrl,
        expiresMinutes: Math.round(RESET_TOKEN_TTL_MS / 60000),
      }),
    });
    this.logger.log(`Password-reset link issued for ${user.email}`);
    return genericOk;
  }

  /**
   * Look up a still-valid (unconsumed, unexpired) token of a given type by its
   * raw value. Returns the token row or null.
   */
  private async findValidToken(raw: string, type: string) {
    const token = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: this.hashToken(raw) },
    });
    if (!token || token.type !== type) return null;
    if (token.consumedAt) return null;
    if (token.expiresAt < new Date()) return null;
    return token;
  }

  /**
   * GAPS #8 — reset-password. Validates the single-use token, sets the new
   * password, marks the token consumed, and revokes ALL of the user's sessions
   * (force re-login everywhere).
   */
  async resetPassword(raw: string, newPassword: string): Promise<{ message: string }> {
    const token = await this.findValidToken(raw, TOKEN_TYPE.PASSWORD_RESET);
    if (!token) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { password: hashedPassword },
      }),
      // Single-use: consume this token AND any other outstanding reset tokens.
      this.prisma.verificationToken.updateMany({
        where: {
          userId: token.userId,
          type: TOKEN_TYPE.PASSWORD_RESET,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      }),
      // Revoke every session so a leaked/compromised token can't keep access.
      this.prisma.session.deleteMany({ where: { userId: token.userId } }),
    ]);

    this.logger.log(`Password reset for user ${token.userId}; sessions revoked`);
    return { message: 'Password has been reset. Please log in again.' };
  }

  /**
   * GAPS #8 — verify-email. Validates the single-use token and stamps
   * User.emailVerified. Idempotent-ish: a consumed/expired token is rejected.
   */
  async verifyEmail(raw: string): Promise<{ message: string }> {
    const token = await this.findValidToken(raw, TOKEN_TYPE.EMAIL_VERIFY);
    if (!token) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { emailVerified: new Date() },
      }),
      this.prisma.verificationToken.update({
        where: { id: token.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    this.logger.log(`Email verified for user ${token.userId}`);
    return { message: 'Email verified.' };
  }

  /**
   * Idempotent membership backfill for an EXISTING user (Phase 5): ensure the
   * user belongs to at least one tenant and has a sensible activeTenantId, WITHOUT
   * creating a second tenant. Used by the cross-domain token-exchange where the
   * user typically already exists. Returns the (possibly updated) tenant ids.
   *
   *  - If the user already has memberships, only fix activeTenantId if unset.
   *  - Else if the user has a home tenantId, create the missing OWNER Membership
   *    to that tenant and select it as active.
   *  - Else (no tenant at all) provision a fresh owned tenant via the shared
   *    primitive — but on the existing user, never a duplicate user.
   */
  private async ensureMembershipForExistingUser(userId: string): Promise<{
    tenantId: string | null;
    activeTenantId: string | null;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
        activeTenantId: true,
        memberships: { select: { tenantId: true } },
      },
    });
    if (!user) {
      return { tenantId: null, activeTenantId: null };
    }

    // Already a member of something: just make sure an active tenant is selected.
    if (user.memberships.length > 0) {
      const active =
        user.activeTenantId && user.memberships.some((m) => m.tenantId === user.activeTenantId)
          ? user.activeTenantId
          : (user.memberships[0].tenantId ?? null);
      if (active && active !== user.activeTenantId) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { activeTenantId: active, tenantId: user.tenantId ?? active },
        });
      }
      return { tenantId: user.tenantId ?? active, activeTenantId: active };
    }

    // No memberships but a home tenant exists: backfill the OWNER membership there.
    if (user.tenantId) {
      await this.prisma.membership.upsert({
        where: { userId_tenantId: { userId: user.id, tenantId: user.tenantId } },
        create: { userId: user.id, tenantId: user.tenantId, role: 'OWNER' },
        update: {},
      });
      await this.prisma.user.update({
        where: { id: user.id },
        data: { activeTenantId: user.tenantId },
      });
      this.logger.log(
        `Backfilled OWNER membership for ${user.email} → tenant ${user.tenantId}`,
      );
      return { tenantId: user.tenantId, activeTenantId: user.tenantId };
    }

    // No tenant at all: provision a fresh owned tenant for this existing user.
    const businessName = user.name || user.email.split('@')[0];
    const slug = await this.generateUniqueSlug(businessName);
    const tenant = await this.prisma.tenant.create({
      data: {
        slug,
        name: businessName,
        status: 'ACTIVE',
        plan: PLANS[TRIAL_PLAN].key,
        subscriptionStatus: 'TRIALING',
        trialEndsAt: computeTrialEnd(),
      },
    });
    await this.prisma.membership.create({
      data: { userId: user.id, tenantId: tenant.id, role: 'OWNER' },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { tenantId: tenant.id, activeTenantId: tenant.id, role: 'OWNER' },
    });
    this.logger.log(
      `Provisioned owned tenant ${tenant.id} (${slug}) + OWNER membership for existing user ${user.email}`,
    );
    return { tenantId: tenant.id, activeTenantId: tenant.id };
  }

  /** Build a URL-safe, unique tenant slug from a business name. */
  private async generateUniqueSlug(base: string): Promise<string> {
    const root =
      base
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'tenant';

    let candidate = root;
    let suffix = 0;
    // Collision-resistant: append a short random suffix on conflict.
    while (await this.prisma.tenant.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${root}-${randomBytes(2).toString('hex')}`;
      if (suffix > 5) {
        candidate = `${root}-${randomBytes(4).toString('hex')}`;
        break;
      }
    }
    return candidate;
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
        select: { id: true, email: true, name: true, role: true, tenantId: true },
      });
      this.logger.log(`Admin user updated: ${updated.email} → ${role}`);
      return updated;
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: { email, name, password: hashedPassword, role },
      select: { id: true, email: true, name: true, role: true, tenantId: true },
    });

    this.logger.log(`Admin user provisioned: ${user.email} (${role})`);
    return user;
  }

  async login(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId?: string | null;
    activeTenantId?: string | null;
  }): Promise<AuthResponseDto> {
    this.logger.log(`User logged in: ${user.email}`);
    return this.createTokens(user);
  }

  /**
   * Re-issue an access/refresh token pair for a user, carrying a (possibly new)
   * active tenant in the JWT `tid` claim (Phase 5 / W1a — tenant switch). Public
   * wrapper around the private token factory so the tenants module can re-issue
   * after a membership-checked switch without touching the login flow.
   */
  async issueTokensForUser(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId?: string | null;
    activeTenantId?: string | null;
  }): Promise<AuthResponseDto> {
    return this.createTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            tenantId: true,
            activeTenantId: true,
          },
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
        isSuperAdmin: true,
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
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        activeTenantId: true,
      },
    });

    let authUser: {
      id: string;
      email: string;
      name: string;
      role: string;
      tenantId?: string | null;
      activeTenantId?: string | null;
    };

    if (!user) {
      // Brand-new platform-linked user: provision their OWN Tenant + OWNER
      // Membership + activeTenantId via the shared onboarding primitive, exactly
      // like signup/register/oauth (Phase 5). No password (platform-linked).
      const created = await this.createUserOwnedTenant({
        email,
        name: customerName,
        password: null,
        logContext: 'Platform-linked user via token exchange',
      });
      authUser = created.user;
    } else {
      // Existing user: ENSURE a Membership + sensible activeTenantId idempotently.
      // Never creates a second tenant for a user who already has one.
      const { tenantId, activeTenantId } = await this.ensureMembershipForExistingUser(
        user.id,
      );
      authUser = { ...user, tenantId, activeTenantId };
    }

    // 3. Generate API Gateway tokens
    const tokens = await this.createTokens(authUser);

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
    tenantId?: string | null;
    activeTenantId?: string | null;
  }): Promise<AuthResponseDto> {
    const jti = randomBytes(16).toString('hex');
    // Multi-tenant SaaS (Phase 5): the JWT `tid` carries the user's ACTIVE tenant
    // (the currently-selected business). Falls back to the home tenantId, then to
    // the local/demo bootstrap tenant for legacy/bootstrap users with no tenant.
    const tid = user.activeTenantId ?? user.tenantId ?? DEMO_TENANT_ID;
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tid,
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
