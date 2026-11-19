import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestContext, resetSalesAndStock, TestContext } from './test-helper.js';
import { Role } from '@snackflow/shared';

describe('Integration — Concurrency & Row-Level Locking Race Condition Test', () => {
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

  it('proves that two concurrent dispatches against the same stock batch cannot double-spend: exactly one wins and one fails', async () => {
    // 1. Check current FG balance in opening stock
    const initialBal = await ctx.prisma.stockBalance.findFirst({
      where: {
        companyId: ctx.companyId,
        itemId: ctx.items.fgMurukku.id,
        batch: { batchNo: 'OPENING' },
      },
      include: { batch: true },
    });
    expect(initialBal).toBeDefined();

    // Set stock balance to 100 so both orders can reserve 50 packets
    await ctx.prisma.stockBalance.update({
      where: { id: initialBal!.id },
      data: { qty: 100, value: 100 * 20 },
    });

    // 2. Create two separate orders for Retailer A and Distributor B, each requesting 50 packets
    const order1Res = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .send({
        clientUuid: uuidv4(),
        partyId: ctx.parties.retailerA.id,
        lines: [
          {
            itemId: ctx.items.fgMurukku.id,
            qty: 50,
            rate: 50.0,
            uom: 'PKT',
          },
        ],
      });
    expect(order1Res.status).toBe(201);
    const order1Id = order1Res.body.id;

    const order2Res = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .send({
        clientUuid: uuidv4(),
        partyId: ctx.parties.distributorB.id,
        lines: [
          {
            itemId: ctx.items.fgMurukku.id,
            qty: 50,
            rate: 50.0,
            uom: 'PKT',
          },
        ],
      });
    expect(order2Res.status).toBe(201);
    const order2Id = order2Res.body.id;

    // 3. Admin approves both orders
    const app1 = await request(ctx.app.getHttpServer())
      .post(`/orders/${order1Id}/approve`)
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ action: 'APPROVE_FULL' });
    expect(app1.status).toBe(201);

    const app2 = await request(ctx.app.getHttpServer())
      .post(`/orders/${order2Id}/approve`)
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ action: 'APPROVE_FULL' });
    expect(app2.status).toBe(201);

    // 4. Admin creates invoices for both orders
    const inv1Res = await request(ctx.app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ orderId: order1Id });
    expect(inv1Res.status).toBe(201);
    const invoice1Id = inv1Res.body.id;

    const inv2Res = await request(ctx.app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ orderId: order2Id });
    expect(inv2Res.status).toBe(201);
    const invoice2Id = inv2Res.body.id;

    // 5. Now reduce physical stock in the batch to exactly 50 packets
    // This creates the race condition: 2 invoices wanting 50 each, but only 50 available!
    await ctx.prisma.stockBalance.update({
      where: { id: initialBal!.id },
      data: { qty: 50, value: 50 * 20 },
    });

    // 6. Concurrently dispatch both invoices at the exact same millisecond!
    const [resDispatch1, resDispatch2] = await Promise.all([
      request(ctx.app.getHttpServer())
        .post('/dispatches')
        .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
        .send({ invoiceId: invoice1Id }),
      request(ctx.app.getHttpServer())
        .post('/dispatches')
        .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
        .send({ invoiceId: invoice2Id }),
    ]);

    const statuses = [resDispatch1.status, resDispatch2.status];

    // Exactly one must succeed (201) and the other must fail with 400 (Insufficient Stock)
    expect(statuses).toContain(201);
    expect(statuses).toContain(400);

    // Verify error message on failed request (RFC 7807 uses detail)
    const failedRes = resDispatch1.status === 400 ? resDispatch1 : resDispatch2;
    const errorText = failedRes.body.detail || failedRes.body.message;
    expect(errorText).toContain('Insufficient stock');

    // 7. Verify final stock balance: must NOT be negative under any circumstances!
    const finalBal = await ctx.prisma.stockBalance.findUnique({
      where: { id: initialBal!.id },
    });
    expect(finalBal!.qty.toNumber()).toBe(0);
  });
});
