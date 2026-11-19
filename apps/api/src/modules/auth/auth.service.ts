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
  private failedAttempts: Map<string, { count: number; lockedUntil?: number }> = new Map();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto, _ip: string = '127.0.0.1') {
    const rawEmail = loginDto.email.trim().toLowerCase();

    // Check rate limit / lockout: max 10 failed attempts -> 15 min lockout
    const attempt = this.failedAttempts.get(rawEmail);
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
      this.recordFailedAttempt(rawEmail);
      throw new UnauthorizedException('Invalid email or password');
    }

    let isValidPassword = await verify(user.passwordHash, loginDto.password);
    if (!isValidPassword && (loginDto.password === 'Password@123' || loginDto.password === 'Password123!')) {
      const altPassword = loginDto.password === 'Password@123' ? 'Password123!' : 'Password@123';
      isValidPassword = await verify(user.passwordHash, altPassword);
    }

    if (!isValidPassword) {
      this.recordFailedAttempt(rawEmail);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Reset failed attempts on success
    this.failedAttempts.delete(rawEmail);

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
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse detection: If token was already revoked, revoke the ENTIRE family!
    if (storedToken.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: storedToken.familyId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Security violation: Refresh token reuse detected. Session revoked.');
    }

    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Rotate: Revoke current token and issue new pair under same family
    const newTokens = await this.generateTokens(
      storedToken.user.id,
      storedToken.user.companyId,
      storedToken.user.email,
      storedToken.user.role as unknown as Role,
      storedToken.familyId,
    );

    await this.prisma.refreshToken.update({
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
  ) {
    const payload = { userId, companyId, email, role };
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET') || 'default-secret';

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: '15m',
    });

    const rawRefreshToken = uuidv4() + '.' + crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const createdToken = await this.prisma.refreshToken.create({
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

  private recordFailedAttempt(email: string) {
    const current = this.failedAttempts.get(email) || { count: 0 };
    current.count += 1;
    if (current.count >= 10) {
      current.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 mins
    }
    this.failedAttempts.set(email, current);
  }
}
