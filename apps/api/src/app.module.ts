import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AuthGuard } from './core/guards/auth.guard.js';
import { RbacGuard } from './core/guards/rbac.guard.js';
import { Rfc7807ExceptionFilter } from './core/filters/rfc7807-exception.filter.js';
import { ZodValidationPipe } from './core/pipes/zod-validation.pipe.js';
import { IdempotencyInterceptor } from './core/interceptors/idempotency.interceptor.js';
import { AuditInterceptor } from './core/interceptors/audit.interceptor.js';
import { HealthController } from './core/controllers/health.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
    {
      provide: APP_FILTER,
      useClass: Rfc7807ExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
