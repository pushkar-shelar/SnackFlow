import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../src/core/guards/auth.guard.js';
import { RbacGuard } from '../../src/core/guards/rbac.guard.js';
import { Public, RequirePermission } from '../../src/core/decorators/require-permission.decorator.js';
import { Permission, Role } from '@snackflow/shared';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Controller('test')
class TestController {
  @Public()
  @Get('public-endpoint')
  publicEndpoint() {
    return { status: 'public_ok' };
  }

  // Unannotated route: lacks @RequirePermission and @Public()
  @Get('unannotated-endpoint')
  unannotatedEndpoint() {
    return { status: 'should_not_reach_here' };
  }

  @RequirePermission(Permission.ORDER_CREATE)
  @Get('order-create-endpoint')
  orderCreateEndpoint() {
    return { status: 'order_create_ok' };
  }
}

describe('Security Pipeline — Default Deny & RBAC Verification (Gate 0)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeEach(async () => {
    jwtService = new JwtService({ secret: 'test-secret' });

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TestController],
      providers: [
        Reflector,
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'JWT_ACCESS_SECRET' ? 'test-secret' : null),
          },
        },
        {
          provide: APP_GUARD,
          useClass: AuthGuard,
        },
        {
          provide: APP_GUARD,
          useClass: RbacGuard,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('should ALLOW access to @Public() endpoint without token', async () => {
    const res = await request(app.getHttpServer()).get('/test/public-endpoint');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('public_ok');
  });

  it('PROVES an unannotated route is REJECTED by Default-Deny RBAC guard', async () => {
    // Generate valid Salesman token
    const token = jwtService.sign({
      userId: 'test-user-id',
      companyId: 'test-company-id',
      email: 'salesman@test.com',
      role: Role.SALESMAN,
    });

    const res = await request(app.getHttpServer())
      .get('/test/unannotated-endpoint')
      .set('Authorization', `Bearer ${token}`);

    // Must be 403 Forbidden because it lacks @RequirePermission
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Default Deny');
  });

  it('should ALLOW role with required permission and FORBID role without permission', async () => {
    // 1. Salesman has ORDER_CREATE -> Allowed (200)
    const salesmanToken = jwtService.sign({
      userId: 'salesman-id',
      companyId: 'company-id',
      email: 'salesman@test.com',
      role: Role.SALESMAN,
    });

    const resSalesman = await request(app.getHttpServer())
      .get('/test/order-create-endpoint')
      .set('Authorization', `Bearer ${salesmanToken}`);

    expect(resSalesman.status).toBe(200);
    expect(resSalesman.body.status).toBe('order_create_ok');

    // 2. Auditor does NOT have ORDER_CREATE -> Forbidden (403)
    const auditorToken = jwtService.sign({
      userId: 'auditor-id',
      companyId: 'company-id',
      email: 'auditor@test.com',
      role: Role.AUDITOR,
    });

    const resAuditor = await request(app.getHttpServer())
      .get('/test/order-create-endpoint')
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(resAuditor.status).toBe(403);
    expect(resAuditor.body.message).toContain("Role 'AUDITOR' lacks required permission 'order:create'");
  });
});
