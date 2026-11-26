import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

interface RateBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly MAX_BUCKETS = 10000;
  private readonly buckets = new Map<string, RateBucket>();

  constructor(@Optional() @Inject(ConfigService) private readonly configService?: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const nodeEnv = this.configService?.get<string>('NODE_ENV') || process.env.NODE_ENV;
    const explicitMax = this.configService?.get<string>('RATE_LIMIT_MAX') || process.env.RATE_LIMIT_MAX;

    // Avoid tripping dense automated integration test loops on localhost unless explicitly configured
    if (nodeEnv === 'test' && !explicitMax) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const path = request.originalUrl || request.url || '';
    if (path.includes('/health')) {
      return true;
    }

    const isSensitivePublic = path.includes('/auth/') || path.includes('/invoices/public/');
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
    const defaultMax = isSensitivePublic ? 40 : 240;
    const maxRequests = explicitMax ? Math.max(1, Number(explicitMax)) : defaultMax;

    const ip = request.ip || (request.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const key = `${ip}:${isSensitivePublic ? 'auth' : 'api'}`;
    const now = Date.now();

    if (this.buckets.size >= RateLimitGuard.MAX_BUCKETS) {
      for (const [k, v] of this.buckets.entries()) {
        if (v.resetAt <= now) {
          this.buckets.delete(k);
        }
      }
      if (this.buckets.size >= RateLimitGuard.MAX_BUCKETS) {
        const oldest = this.buckets.keys().next().value;
        if (oldest) this.buckets.delete(oldest);
      }
    }

    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
    }

    bucket.count += 1;
    this.buckets.set(key, bucket);

    const remaining = Math.max(0, maxRequests - bucket.count);
    response.setHeader('X-RateLimit-Limit', String(maxRequests));
    response.setHeader('X-RateLimit-Remaining', String(remaining));

    if (bucket.count > maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      response.setHeader('Retry-After', String(retryAfterSec));
      throw new HttpException(
        `Rate limit exceeded. Try again in ${retryAfterSec} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
