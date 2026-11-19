import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestContext, resetSalesAndStock, TestContext } from './test-helper.js';
import { Role } from '@snackflow/shared';

describe('Integration — Comprehensive RBAC Permission Matrix Verification', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(async () => {
    await resetSalesAndStock(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('proves that unauthenticated requests are strictly rejected with 401', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/orders');
    expect(res.status).toBe(401);
  });

  it('verifies SALESMAN permissions: CAN create order, CANNOT approve, CANNOT invoice, CANNOT post production', async () => {
    // 1. Can create order (201)
    const createRes = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .send({
        clientUuid: uuidv4(),
        partyId: ctx.parties.retailerA.id,
        lines: [
          {
            itemId: ctx.items.fgMurukku.id,
            qty: 5,
            rate: 50.0,
            uom: 'PKT',
          },
        ],
      });
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.id;

    // 2. Cannot approve order (403)
    const approveRes = await request(ctx.app.getHttpServer())
      .post(`/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .send({ action: 'APPROVE_FULL' });
    expect(approveRes.status).toBe(403);

    // 3. Cannot post invoice (403)
    const invoiceRes = await request(ctx.app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .send({ orderId });
    expect(invoiceRes.status).toBe(403);

    // 4. Cannot create production run (403)
    const recipe = await ctx.prisma.recipe.findFirst({ where: { companyId: ctx.companyId } });
    const prodRes = await request(ctx.app.getHttpServer())
      .post('/production/runs/draft')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .send({
        recipeId: recipe!.id,
        fgItemId: ctx.items.fgMurukku.id,
      });
    expect(prodRes.status).toBe(403);
  });

  it('verifies AUDITOR role is read-only by construction: CAN read invoices/reports, CANNOT mutate any state', async () => {
    // 1. Can read invoices (200)
    const listRes = await request(ctx.app.getHttpServer())
      .get('/invoices')
      .set('Authorization', `Bearer ${ctx.users[Role.AUDITOR].token}`);
    expect(listRes.status).toBe(200);

    // 2. Cannot create order (403)
    const createOrderRes = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.AUDITOR].token}`)
      .send({
        clientUuid: uuidv4(),
        partyId: ctx.parties.retailerA.id,
        lines: [{ itemId: ctx.items.fgMurukku.id, qty: 5, rate: 50, uom: 'PKT' }],
      });
    expect(createOrderRes.status).toBe(403);

    // 3. Cannot post invoice (403)
    const invRes = await request(ctx.app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${ctx.users[Role.AUDITOR].token}`)
      .send({ orderId: uuidv4() });
    expect(invRes.status).toBe(403);

    // 4. Cannot dispatch (403)
    const dispRes = await request(ctx.app.getHttpServer())
      .post('/dispatches')
      .set('Authorization', `Bearer ${ctx.users[Role.AUDITOR].token}`)
      .send({ invoiceId: uuidv4() });
    expect(dispRes.status).toBe(403);

    // 5. Cannot record payments (403)
    const payRes = await request(ctx.app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${ctx.users[Role.AUDITOR].token}`)
      .send({
        partyId: ctx.parties.retailerA.id,
        amount: 500,
        mode: 'CASH',
        reference: 'CASH-01',
      });
    expect(payRes.status).toBe(403);
  });

  it('verifies PRODUCTION role: CAN create production drafts, CANNOT approve orders or post invoices', async () => {
    const recipe = await ctx.prisma.recipe.findFirst({ where: { companyId: ctx.companyId } });

    // 1. Can create draft production run (201)
    const draftRes = await request(ctx.app.getHttpServer())
      .post('/production/runs/draft')
      .set('Authorization', `Bearer ${ctx.users[Role.PRODUCTION].token}`)
      .send({
        recipeId: recipe!.id,
        fgItemId: ctx.items.fgMurukku.id,
        batchFactor: 1.0,
      });
    expect(draftRes.status).toBe(201);

    // 2. Cannot approve order (403)
    const appRes = await request(ctx.app.getHttpServer())
      .post(`/orders/${uuidv4()}/approve`)
      .set('Authorization', `Bearer ${ctx.users[Role.PRODUCTION].token}`)
      .send({ action: 'APPROVE_FULL' });
    expect(appRes.status).toBe(403);

    // 3. Cannot post invoice (403)
    const invRes = await request(ctx.app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${ctx.users[Role.PRODUCTION].token}`)
      .send({ orderId: uuidv4() });
    expect(invRes.status).toBe(403);
  });
});
