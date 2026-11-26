import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { catchError, finalize, mergeMap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import * as crypto from 'crypto';

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableSerialize((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const method = request.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const rawKey = request.headers['idempotency-key'];
    const idempotencyKey = typeof rawKey === 'string' ? rawKey.trim() : undefined;
    if (!idempotencyKey) {
      return next.handle();
    }
    if (idempotencyKey.length > 128) {
      throw new BadRequestException('Idempotency-Key must be at most 128 characters');
    }

    const user = (request as any).user;
    const userId = user?.userId;

    if (!userId) {
      return next.handle();
    }

    const requestCanonical = stableSerialize({
      method,
      path: request.originalUrl || request.url,
      body: request.body ?? {},
    });
    const requestHash = crypto.createHash('sha256').update(requestCanonical).digest('hex');

    // Serialize concurrent requests using the same key in this worker process
    const pending = this.inFlight.get(idempotencyKey);
    if (pending) {
      await pending.catch(() => undefined);
    }

    // Check if key exists
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException('Idempotency-Key already in use by another user');
      }
      const [storedReqHash] = existing.responseHash.split(':');
      if (existing.responseHash.includes(':') && storedReqHash !== requestHash) {
        throw new ConflictException(
          'Idempotency-Key reused with a different request payload',
        );
      }
      response.setHeader('X-Cache', 'HIT-IDEMPOTENT');
      response.status(existing.statusCode);
      return of(existing.responseBody);
    }

    let resolveInFlight!: () => void;
    const inFlightPromise = new Promise<void>((resolve) => {
      resolveInFlight = resolve;
    });
    this.inFlight.set(idempotencyKey, inFlightPromise);

    return next.handle().pipe(
      mergeMap(async (body: any) => {
        const statusCode = response.statusCode || 200;
        if (statusCode >= 200 && statusCode < 300) {
          try {
            const bodyStr = JSON.stringify(body ?? {});
            const resHash = crypto.createHash('sha256').update(bodyStr).digest('hex');
            await this.prisma.idempotencyKey.create({
              data: {
                key: idempotencyKey,
                userId,
                responseHash: `${requestHash}:${resHash}`,
                responseBody: body ?? {},
                statusCode,
              },
            });
          } catch {
            // If concurrent insert occurred across processes, ignore
          }
        }
        return body;
      }),
      catchError((err) => {
        throw err;
      }),
      finalize(() => {
        this.inFlight.delete(idempotencyKey);
        resolveInFlight();
      }),
    );
  }
}
