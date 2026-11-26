import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { v4 as uuidv4 } from 'uuid';

const SENSITIVE_KEY_PATTERN = /password|passcode|token|secret|authorization|cookie|credential/i;

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : redactSensitive(val);
    }
    return out;
  }
  return value;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const user = (request as any).user;
    const actorId = user?.userId;
    const companyId = user?.companyId;
    const ip = request.ip || (request.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    const action = `${method} ${request.url}`;
    const entity = request.url.split('/')[3] || 'resource';
    const sanitizedBefore = redactSensitive(request.body ?? {}) as object;

    return next.handle().pipe(
      tap(async (responseBody: any) => {
        try {
          const entityId = responseBody?.id || (request.params as any)?.id || 'unknown';
          const sanitizedAfter = redactSensitive(responseBody ?? {}) as object;
          await this.prisma.auditLog.create({
            data: {
              companyId,
              actorId,
              action,
              entity,
              entityId: String(entityId),
              beforeJson: sanitizedBefore,
              afterJson: sanitizedAfter,
              ip,
              requestId,
            },
          });
        } catch {
          // Prevent audit failure from aborting response
        }
      }),
    );
  }
}
