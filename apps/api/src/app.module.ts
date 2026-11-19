import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { PurchasingModule } from './modules/purchasing/purchasing.module.js';
import { ProductionModule } from './modules/production/production.module.js';
import { PartiesModule } from './modules/parties/parties.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { SalesModule } from './modules/sales/sales.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { AlertsModule } from './modules/alerts/alerts.module.js';
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
    InventoryModule,
    PurchasingModule,
    ProductionModule,
    PartiesModule,
    CatalogModule,
    SalesModule,
    BillingModule,
    PaymentsModule,
    ReportsModule,
    AlertsModule,
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
      useFactory: () => new ZodValidationPipe(),
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
