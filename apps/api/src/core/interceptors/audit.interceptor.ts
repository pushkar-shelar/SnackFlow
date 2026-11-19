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

    return next.handle().pipe(
      tap(async (responseBody: any) => {
        try {
          const entityId = responseBody?.id || (request.params as any)?.id || 'unknown';
          await this.prisma.auditLog.create({
            data: {
              companyId,
              actorId,
              action,
              entity,
              entityId: String(entityId),
              beforeJson: request.body ?? {},
              afterJson: responseBody ?? {},
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
