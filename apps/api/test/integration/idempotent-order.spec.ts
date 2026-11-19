import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestContext, resetSalesAndStock, TestContext } from './test-helper.js';
import { Role } from '@snackflow/shared';

describe('Integration — Idempotent Order Capture', () => {
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

  it('should return identical order on duplicate client_uuid without creating duplicate rows', async () => {
    const clientUuid = uuidv4();
    const payload = {
      clientUuid,
      partyId: ctx.parties.retailerA.id,
      lines: [
        {
          itemId: ctx.items.fgMurukku.id,
          qty: 10,
          rate: 50.0,
          uom: 'PKT',
        },
      ],
    };

    // First submission
    const res1 = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res1.body.id).toBeDefined();
    expect(res1.body.clientUuid).toBe(clientUuid);
    const orderId1 = res1.body.id;

    // Second submission with exact same clientUuid
    const res2 = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .send(payload);

    expect([200, 201]).toContain(res2.status);
    expect(res2.body.id).toBe(orderId1);
    expect(res2.body.clientUuid).toBe(clientUuid);

    // Assert database has exactly one order with this clientUuid
    const dbOrders = await ctx.prisma.salesOrder.findMany({
      where: { clientUuid },
    });
    expect(dbOrders.length).toBe(1);
    expect(dbOrders[0]!.id).toBe(orderId1);

    // Assert reservations exist for this order
    const reservations = await ctx.prisma.stockReservation.findMany({
      where: { orderLine: { orderId: orderId1 } },
    });
    expect(reservations.length).toBe(1);
    expect(reservations[0]!.qty.toNumber()).toBe(10);
  });
});
