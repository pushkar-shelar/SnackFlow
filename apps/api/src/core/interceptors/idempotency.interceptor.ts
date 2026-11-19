import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import * as crypto from 'crypto';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const method = request.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
      return next.handle();
    }

    const user = (request as any).user;
    const userId = user?.userId;

    if (!userId) {
      return next.handle();
    }

    // Check if key exists
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existing) {
      response.setHeader('X-Cache', 'HIT-IDEMPOTENT');
      response.status(existing.statusCode);
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      tap(async (body: any) => {
        try {
          const bodyStr = JSON.stringify(body ?? {});
          const hash = crypto.createHash('sha256').update(bodyStr).digest('hex');
          await this.prisma.idempotencyKey.create({
            data: {
              key: idempotencyKey,
              userId,
              responseHash: hash,
              responseBody: body ?? {},
              statusCode: response.statusCode || 200,
            },
          });
        } catch {
          // If concurrent insert occurred, ignore
        }
      }),
    );
  }
}
