import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/require-permission.decorator.js';
import { AuthenticatedUser } from '../decorators/current-user.decorator.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (isPublic) {
      if (token) {
        try {
          const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
          if (secret) {
            const payload = await this.jwtService.verifyAsync(token, {
              secret,
              algorithms: ['HS256'],
            });
            if (payload?.userId && payload?.companyId && payload?.role) {
              request.user = payload as AuthenticatedUser;
            }
          }
        } catch {
          // Public route: ignore invalid token
        }
      }
      return true;
    }

    if (!token) {
      throw new UnauthorizedException('Authentication token required');
    }

    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new UnauthorizedException('Authentication secret is not configured');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret,
        algorithms: ['HS256'],
      });
      if (!payload?.userId || !payload?.companyId || !payload?.role) {
        throw new UnauthorizedException('Malformed authentication token');
      }
      request.user = payload as AuthenticatedUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    if (request.cookies?.access_token) {
      return request.cookies.access_token;
    }
    return null;
  }
}
