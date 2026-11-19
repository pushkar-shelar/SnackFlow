import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestContext, resetSalesAndStock, TestContext } from './test-helper.js';
import { Role, MovementType, InvoiceStatus, OrderStatus, RunStatus } from '@snackflow/shared';

describe('Integration — Reversals & Credit Notes (Stock Restoration)', () => {
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

  it('proves that issuing a credit note on a dispatched invoice cancels the invoice, cancels the order, and restores stock via RETURN movements', async () => {
    // 1. Create order for Retailer A (20 PKT)
    const orderRes = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .send({
        clientUuid: uuidv4(),
        partyId: ctx.parties.retailerA.id,
        lines: [
          {
            itemId: ctx.items.fgMurukku.id,
            qty: 20,
            rate: 50.0,
            uom: 'PKT',
          },
        ],
      });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.id;

    // 2. Approve order
    const appRes = await request(ctx.app.getHttpServer())
      .post(`/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ action: 'APPROVE_FULL' });
    expect(appRes.status).toBe(201);

    // 3. Post invoice
    const invRes = await request(ctx.app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ orderId });
    expect(invRes.status).toBe(201);
    const invoiceId = invRes.body.id;

    // 4. Dispatch invoice (consuming 20 PKT from opening batch of 50 PKT -> 30 PKT remaining)
    const dispRes = await request(ctx.app.getHttpServer())
      .post('/dispatches')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ invoiceId });
    expect(dispRes.status).toBe(201);

    const fgBalAfterDispatch = await ctx.prisma.stockBalance.findFirst({
      where: {
        companyId: ctx.companyId,
        itemId: ctx.items.fgMurukku.id,
        batch: { batchNo: 'OPENING' },
      },
    });
    expect(fgBalAfterDispatch!.qty.toNumber()).toBe(30);

    // 5. Admin issues a Credit Note to cancel invoice
    const cnRes = await request(ctx.app.getHttpServer())
      .post(`/invoices/${invoiceId}/credit-note`)
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ reason: 'Customer returned damaged goods' });

    expect(cnRes.status).toBe(201);
    expect(cnRes.body.creditNoteNo).toContain('CN/');
    expect(cnRes.body.total).toBe(invRes.body.total);

    // 6. Verify invoice status is CANCELLED and sales order status is CANCELLED
    const cancelledInvoice = await ctx.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    expect(cancelledInvoice!.status).toBe(InvoiceStatus.CANCELLED);

    const cancelledOrder = await ctx.prisma.salesOrder.findUnique({
      where: { id: orderId },
    });
    expect(cancelledOrder!.status).toBe(OrderStatus.CANCELLED);

    // 7. Verify stock has been returned to the batch (30 + 20 = 50 PKT!)
    const fgBalAfterReturn = await ctx.prisma.stockBalance.findFirst({
      where: {
        companyId: ctx.companyId,
        itemId: ctx.items.fgMurukku.id,
        batch: { batchNo: 'OPENING' },
      },
    });
    expect(fgBalAfterReturn!.qty.toNumber()).toBe(50);

    // 8. Verify ledger has RETURN movement row
    const returnLedger = await ctx.prisma.stockLedger.findFirst({
      where: {
        companyId: ctx.companyId,
        itemId: ctx.items.fgMurukku.id,
        movementType: MovementType.RETURN,
      },
    });
    expect(returnLedger).toBeDefined();
    expect(returnLedger!.qtyIn.toNumber()).toBe(20);
  });

  it('proves that reversing a production run offsets stock movements and returns balances to prior state', async () => {
    // 1. Get recipe
    const recipe = await ctx.prisma.recipe.findFirst({
      where: { companyId: ctx.companyId },
    });
    expect(recipe).toBeDefined();

    // 2. Create draft run
    const draftRes = await request(ctx.app.getHttpServer())
      .post('/production/runs/draft')
      .set('Authorization', `Bearer ${ctx.users[Role.PRODUCTION].token}`)
      .send({
        recipeId: recipe!.id,
        fgItemId: ctx.items.fgMurukku.id,
        batchFactor: 1.0,
      });
    expect(draftRes.status).toBe(201);
    const runId = draftRes.body.id;

    // Record stock before posting run
    const flourBalBefore = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: ctx.items.rmFlour.id },
    });
    const flourQtyBefore = flourBalBefore!.qty.toNumber();

    // 3. Post run with actual inputs
    const postRes = await request(ctx.app.getHttpServer())
      .post(`/production/runs/${runId}/post`)
      .set('Authorization', `Bearer ${ctx.users[Role.PRODUCTION].token}`)
      .send({
        actualInputs: [
          { itemId: ctx.items.rmFlour.id, actualQty: 40, uom: 'KG' },
          { itemId: ctx.items.rmOil.id, actualQty: 10.5, uom: 'L' },
          { itemId: ctx.items.pmPouch.id, actualQty: 1.2, uom: 'KG' },
        ],
        goodOutputQty: 188,
        damagedPackagingQty: 6,
        cartonsUsed: 9,
      });
    expect(postRes.status).toBe(201);

    // Flour was consumed
    const flourBalAfter = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: ctx.items.rmFlour.id },
    });
    expect(flourBalAfter!.qty.toNumber()).toBe(flourQtyBefore - 40);

    // 4. Reverse the production run
    const revRes = await request(ctx.app.getHttpServer())
      .post(`/production/runs/${runId}/reverse`)
      .set('Authorization', `Bearer ${ctx.users[Role.PRODUCTION].token}`)
      .send();
    expect(revRes.status).toBe(201);

    // 5. Verify run status is REVERSED
    const reversedRun = await ctx.prisma.productionRun.findUnique({
      where: { id: runId },
    });
    expect(reversedRun!.status).toBe(RunStatus.REVERSED);

    // 6. Verify flour stock balance returned exactly to prior state!
    const flourBalRestored = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: ctx.items.rmFlour.id },
    });
    expect(flourBalRestored!.qty.toNumber()).toBe(flourQtyBefore);
  });
});
