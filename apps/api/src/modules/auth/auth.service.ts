import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { verify } from '@node-rs/argon2';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LoginDto, Role } from '@snackflow/shared';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  private static readonly MAX_TRACKED_ATTEMPTS = 5000;
  private static readonly LOCKOUT_TTL_MS = 15 * 60 * 1000;
  private failedAttempts: Map<string, { count: number; lastAttemptAt: number; lockedUntil?: number }> = new Map();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  private canonicalAttemptKey(email: string): string {
    const normalized = email.trim().toLowerCase();
    return normalized.endsWith('@snackflow.com')
      ? normalized.replace(/@snackflow\.com$/, '@snackflow.local')
      : normalized;
  }

  async login(loginDto: LoginDto, _ip: string = '127.0.0.1') {
    const rawEmail = loginDto.email.trim().toLowerCase();
    const attemptKey = this.canonicalAttemptKey(rawEmail);
    this.pruneExpiredAttempts();

    // Check rate limit / lockout across domain aliases: max 10 failed attempts -> 15 min lockout
    const attempt = this.failedAttempts.get(attemptKey);
    if (attempt && attempt.lockedUntil && attempt.lockedUntil > Date.now()) {
      const waitMinutes = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
      throw new ForbiddenException(`Account temporarily locked. Please try again in ${waitMinutes} minutes.`);
    }

    let user = await this.prisma.user.findUnique({
      where: { email: rawEmail },
    });

    // Ergonomic fallback between .local and .com domains for seeded accounts
    if (!user && rawEmail.endsWith('@snackflow.com')) {
      const localEmail = rawEmail.replace('@snackflow.com', '@snackflow.local');
      user = await this.prisma.user.findUnique({ where: { email: localEmail } });
    } else if (!user && rawEmail.endsWith('@snackflow.local')) {
      const comEmail = rawEmail.replace('@snackflow.local', '@snackflow.com');
      user = await this.prisma.user.findUnique({ where: { email: comEmail } });
    }

    if (!user || !user.isActive) {
      this.recordFailedAttempt(attemptKey);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValidPassword = await verify(user.passwordHash, loginDto.password);
    if (!isValidPassword) {
      this.recordFailedAttempt(attemptKey);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Reset failed attempts on success
    this.failedAttempts.delete(attemptKey);

    // Generate token family
    const familyId = uuidv4();
    const tokens = await this.generateTokens(user.id, user.companyId, user.email, user.role as unknown as Role, familyId);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refreshToken(rawRefreshToken: string) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    const tokenHash = this.hashToken(rawRefreshToken);

    return this.prisma.$transaction(async (tx) => {
      // Lock matching refresh token row to serialize concurrent refresh rotations
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM refresh_token WHERE token_hash = ${tokenHash} FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const storedToken = await tx.refreshToken.findFirst({
        where: { id: locked[0]!.id },
        include: { user: true },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (!storedToken.user.isActive) {
        await tx.refreshToken.updateMany({
          where: { userId: storedToken.userId },
          data: { revokedAt: new Date() },
        });
        throw new ForbiddenException('Account is deactivated');
      }

      // Reuse detection: If token was already revoked, revoke the ENTIRE family!
      if (storedToken.revokedAt) {
        await tx.refreshToken.updateMany({
          where: { familyId: storedToken.familyId },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException('Security violation: Refresh token reuse detected. Session revoked.');
      }

      if (new Date() > storedToken.expiresAt) {
        throw new UnauthorizedException('Refresh token expired');
      }

      const newTokens = await this.generateTokens(
        storedToken.user.id,
        storedToken.user.companyId,
        storedToken.user.email,
        storedToken.user.role as unknown as Role,
        storedToken.familyId,
        tx,
      );

      await tx.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          revokedAt: new Date(),
          replacedBy: newTokens.refreshTokenId,
        },
      });

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      };
    });
  }

  async logout(rawRefreshToken: string) {
    if (!rawRefreshToken) return;
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  private async generateTokens(
    userId: string,
    companyId: string,
    email: string,
    role: Role,
    familyId: string,
    db: { refreshToken: PrismaService['refreshToken'] } = this.prisma,
  ) {
    const payload = { userId, companyId, email, role };
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: '15m',
      algorithm: 'HS256',
    });

    const rawRefreshToken = uuidv4() + '.' + crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const createdToken = await db.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      refreshTokenId: createdToken.id,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private pruneExpiredAttempts() {
    const now = Date.now();
    for (const [key, entry] of this.failedAttempts.entries()) {
      const isExpiredLock = entry.lockedUntil ? entry.lockedUntil <= now : false;
      const isStale = now - entry.lastAttemptAt > AuthService.LOCKOUT_TTL_MS;
      if (isExpiredLock || isStale) {
        this.failedAttempts.delete(key);
      }
    }
  }

  private recordFailedAttempt(email: string) {
    if (this.failedAttempts.size >= AuthService.MAX_TRACKED_ATTEMPTS) {
      this.pruneExpiredAttempts();
      if (this.failedAttempts.size >= AuthService.MAX_TRACKED_ATTEMPTS) {
        const oldestKey = this.failedAttempts.keys().next().value;
        if (oldestKey) this.failedAttempts.delete(oldestKey);
      }
    }
    const now = Date.now();
    const current = this.failedAttempts.get(email) || { count: 0, lastAttemptAt: now };
    current.count += 1;
    current.lastAttemptAt = now;
    if (current.count >= 10) {
      current.lockedUntil = now + AuthService.LOCKOUT_TTL_MS;
    }
    this.failedAttempts.set(email, current);
  }
}
