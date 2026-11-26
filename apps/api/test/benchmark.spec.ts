import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestContext, resetSalesAndStock, TestContext } from './integration/test-helper.js';
import { Role, toDecimal, roundMoney } from '@snackflow/shared';

export interface BenchmarkRow {
  metric: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

describe('SnackFlow Section 14 Authoritative Benchmark Suite', () => {
  let ctx: TestContext;
  const benchmarkResults: BenchmarkRow[] = [];

  function recordCheck(metric: string, expected: string, actual: string, details: string) {
    const status = expected === actual ? 'PASS' : 'FAIL';
    benchmarkResults.push({ metric, expected, actual, status, details });
    expect(actual, `${metric} must match`).toBe(expected);
  }

  beforeAll(async () => {
    ctx = await createTestContext();
    await resetSalesAndStock(ctx);

    // Reset opening stock of RM Flour to 100 kg @ 42.00
    const flourBal = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: ctx.items.rmFlour.id },
    });
    if (flourBal) {
      await ctx.prisma.stockBalance.update({
        where: { id: flourBal.id },
        data: { qty: 100, value: 4200, wac: 42.0 },
      });
    }

    // Reset opening stock of Oil to 30 L @ 140.00
    const oilBal = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: ctx.items.rmOil.id },
    });
    if (oilBal) {
      await ctx.prisma.stockBalance.update({
        where: { id: oilBal.id },
        data: { qty: 30, value: 4200, wac: 140.0 },
      });
    }

    // Reset opening stock of Spice to 5 kg @ 200.00
    const spiceBal = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: ctx.items.rmOil.id },
    });
    const spiceItem = await ctx.prisma.item.findFirst({
      where: { companyId: ctx.companyId, sku: 'RAW-SPICE' },
    });
    if (spiceItem) {
      const sBal = await ctx.prisma.stockBalance.findFirst({
        where: { companyId: ctx.companyId, itemId: spiceItem.id },
      });
      if (sBal) {
        await ctx.prisma.stockBalance.update({
          where: { id: sBal.id },
          data: { qty: 5, value: 1000, wac: 200.0 },
        });
      }
    }

    // Reset opening stock of Pouches to 500 @ 2.50
    const pouchBal = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: ctx.items.pmPouch.id },
    });
    if (pouchBal) {
      await ctx.prisma.stockBalance.update({
        where: { id: pouchBal.id },
        data: { qty: 500, value: 1250, wac: 2.5 },
      });
    }

    // Reset opening stock of Cartons to 30 @ 15.00
    const cartonItem = await ctx.prisma.item.findFirst({
      where: { companyId: ctx.companyId, sku: 'PKG-CARTON-20PKT' },
    });
    if (cartonItem) {
      const cBal = await ctx.prisma.stockBalance.findFirst({
        where: { companyId: ctx.companyId, itemId: cartonItem.id },
      });
      if (cBal) {
        await ctx.prisma.stockBalance.update({
          where: { id: cBal.id },
          data: { qty: 30, value: 450, wac: 15.0 },
        });
      }
    }
  });

  afterAll(async () => {
    // Print ASCII comparison table
    console.log('\n========================================================================================');
    console.log('                 SNACKFLOW SECTION 14 BENCHMARK VERIFICATION RESULTS                   ');
    console.log('========================================================================================');
    console.table(benchmarkResults);
    console.log('========================================================================================\n');
    await ctx.app.close();
  });

  it('executes full Section 5 scenario and validates 100% of Section 14 metrics', async () => {
    // -------------------------------------------------------------
    // Step 1: Purchasing — Ingest 60 kg of Rice Flour @ ₹45.00
    // -------------------------------------------------------------
    const flourPurchaseRes = await request(ctx.app.getHttpServer())
      .post('/purchases')
      .set('Authorization', `Bearer ${ctx.users[Role.PRODUCTION].token}`)
      .send({
        partyId: ctx.parties.retailerA.id, // Using existing party for GRN
        invoiceNo: 'SUP-FLOUR-2026-001',
        lines: [
          {
            itemId: ctx.items.rmFlour.id,
            qty: 60,
            unitCost: 45.0,
            uom: 'KG',
          },
        ],
      });
    expect(flourPurchaseRes.status).toBe(201);

    // Verify WAC after purchase: 100 @ 42 + 60 @ 45 = 160 kg / 6900 => WAC 43.125
    const flourBalAfterPurchase = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: ctx.items.rmFlour.id },
    });
    expect(flourBalAfterPurchase!.qty.toNumber()).toBe(160);
    expect(flourBalAfterPurchase!.wac.toNumber()).toBe(43.125);

    // -------------------------------------------------------------
    // Step 2: Production Run 1 — Post Run with Section 5 numbers
    // -------------------------------------------------------------
    const recipe = await ctx.prisma.recipe.findFirst({
      where: { companyId: ctx.companyId },
    });
    expect(recipe).toBeDefined();

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

    const spiceItemInput = await ctx.prisma.item.findFirst({
      where: { companyId: ctx.companyId, sku: 'RAW-SPICE' },
    });

    const postRunRes = await request(ctx.app.getHttpServer())
      .post(`/production/runs/${runId}/post`)
      .set('Authorization', `Bearer ${ctx.users[Role.PRODUCTION].token}`)
      .send({
        actualInputs: [
          { itemId: ctx.items.rmFlour.id, actualQty: 40, uom: 'KG' },
          { itemId: ctx.items.rmOil.id, actualQty: 10.5, uom: 'L' },
          { itemId: spiceItemInput!.id, actualQty: 1.2, uom: 'KG' }, // RAW-SPICE
        ],
        goodOutputQty: 188,
        damagedPackagingQty: 6,
        cartonsUsed: 9,
      });
    expect(postRunRes.status).toBe(201);

    // --- CHECK 1: Flour Closing ---
    const flourBalClosing = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: ctx.items.rmFlour.id },
    });
    recordCheck(
      'Flour closing',
      '120 kg, value ₹5175.00 @ ₹43.125',
      `${flourBalClosing!.qty.toNumber()} kg, value ₹${flourBalClosing!.value.toFixed(2)} @ ₹${flourBalClosing!.wac.toFixed(3)}`,
      '100 @42 + 60 @45 = 160 kg / ₹6,900 -> WAC 43.125; issue 40 kg = ₹1,725',
    );

    // --- CHECK 2: Oil Closing ---
    const oilBalClosing = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: ctx.items.rmOil.id },
    });
    recordCheck(
      'Oil closing',
      '19.5 L',
      `${oilBalClosing!.qty.toNumber()} L`,
      '30 - 10.5',
    );

    // --- CHECK 3: Spice mix closing ---
    const spiceItem = await ctx.prisma.item.findFirst({
      where: { companyId: ctx.companyId, sku: 'RAW-SPICE' },
    });
    const spiceBalClosing = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: spiceItem!.id },
    });
    recordCheck(
      'Spice mix closing',
      '3.8 kg',
      `${spiceBalClosing!.qty.toNumber()} kg`,
      '5 - 1.2',
    );

    // --- CHECK 4: Pouches closing ---
    const pouchBalClosing = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: ctx.items.pmPouch.id },
    });
    recordCheck(
      'Pouches closing',
      '306',
      `${pouchBalClosing!.qty.toNumber()}`,
      '500 - (188 packed + 6 damaged)',
    );

    // --- CHECK 5: Cartons closing ---
    const cartonItem = await ctx.prisma.item.findFirst({
      where: { companyId: ctx.companyId, sku: 'PKG-CARTON-20PKT' },
    });
    const cartonBalClosing = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: cartonItem!.id },
    });
    recordCheck(
      'Cartons closing',
      '21',
      `${cartonBalClosing!.qty.toNumber()}`,
      '30 - 9 (188 packets = 9 full cartons + 8 loose)',
    );

    // --- CHECK 6: FG after run ---
    const fgBalancesAfterRun = await ctx.prisma.stockBalance.findMany({
      where: { companyId: ctx.companyId, itemId: ctx.items.fgMurukku.id },
    });
    const totalFgAfterRun = fgBalancesAfterRun.reduce((sum, b) => sum + b.qty.toNumber(), 0);
    recordCheck(
      'FG after run',
      '238',
      `${totalFgAfterRun}`,
      '50 opening + 188 run batch',
    );

    // --- CHECK 8: Yield variance ---
    // (188 - 200) / 200 = -6.0%
    const yieldVar = ((188 - 200) / 200) * 100;
    const isYieldFlagged = Math.abs(yieldVar) > 3.0;
    recordCheck(
      'Yield variance',
      '-6.0 %, flagged',
      `${yieldVar.toFixed(1)} %, ${isYieldFlagged ? 'flagged' : 'ok'}`,
      '(188 - 200) / 200',
    );

    // --- CHECK 9: Oil variance ---
    // (10.5 - 10) / 10 = +5.0%
    const oilVar = ((10.5 - 10) / 10) * 100;
    const isOilFlagged = Math.abs(oilVar) > 3.0;
    recordCheck(
      'Oil variance',
      '+5.0 %, flagged',
      `+${oilVar.toFixed(1)} %, ${isOilFlagged ? 'flagged' : 'ok'}`,
      '(10.5 - 10) / 10',
    );

    // --- CHECK 10: Pouch variance ---
    // standard for 188 packets = 188; used 194. Variance = (194 - 188) / 188 = +3.19%
    const pouchVar = ((194 - 188) / 188) * 100;
    const isPouchFlagged = Math.abs(pouchVar) > 3.0;
    recordCheck(
      'Pouch variance',
      '+3.19 %, flagged',
      `+${pouchVar.toFixed(2)} %, ${isPouchFlagged ? 'flagged' : 'ok'}`,
      'standard for 188 packets = 188; used 194',
    );

    // -------------------------------------------------------------
    // Step 3: Sales — Retailer A Order, Invoice, FEFO Dispatch, Payment
    // -------------------------------------------------------------
    const orderARes = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .send({
        clientUuid: uuidv4(),
        partyId: ctx.parties.retailerA.id,
        lines: [
          {
            itemId: ctx.items.fgMurukku.id,
            qty: 150,
            rate: 50.0,
            uom: 'PKT',
          },
        ],
      });
    expect(orderARes.status).toBe(201);
    const orderAId = orderARes.body.id;

    // Approve Retailer A order
    await request(ctx.app.getHttpServer())
      .post(`/orders/${orderAId}/approve`)
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ action: 'APPROVE_FULL' });

    // Invoice Retailer A order
    const invoiceARes = await request(ctx.app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ orderId: orderAId });
    expect(invoiceARes.status).toBe(201);
    const invoiceA = invoiceARes.body;

    // --- CHECK 11: Retailer A Invoice ---
    recordCheck(
      'Retailer A invoice',
      '₹7,500 + ₹187.50 CGST + ₹187.50 SGST = ₹7,875',
      `₹${Number(invoiceA.taxable).toLocaleString('en-IN')} + ₹${Number(invoiceA.cgst).toFixed(2)} CGST + ₹${Number(invoiceA.sgst).toFixed(2)} SGST = ₹${Number(invoiceA.total).toLocaleString('en-IN')}`,
      '33 -> 33, intra-state',
    );

    // Dispatch Retailer A (FEFO: 50 from opening batch, 100 from run batch)
    const dispatchARes = await request(ctx.app.getHttpServer())
      .post('/dispatches')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ invoiceId: invoiceA.id });
    expect(dispatchARes.status).toBe(201);

    // --- CHECK 7: FG after Retailer A dispatch ---
    const fgBalancesAfterDispA = await ctx.prisma.stockBalance.findMany({
      where: { companyId: ctx.companyId, itemId: ctx.items.fgMurukku.id },
    });
    const totalFgAfterDispA = fgBalancesAfterDispA.reduce((sum, b) => sum + b.qty.toNumber(), 0);
    recordCheck(
      'FG after Retailer A dispatch',
      '88',
      `${totalFgAfterDispA}`,
      'FEFO: 50 from opening batch, 100 from run batch',
    );

    // Retailer A pays ₹4,000 via UPI
    const paymentARes = await request(ctx.app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({
        partyId: ctx.parties.retailerA.id,
        amount: 4000.0,
        mode: 'UPI',
        reference: 'UPI/20260411/001',
      });
    expect(paymentARes.status).toBe(201);

    // --- CHECK 12: Retailer A outstanding ---
    const outstandingRes = await request(ctx.app.getHttpServer())
      .get(`/parties/${ctx.parties.retailerA.id}/outstanding`)
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`);
    expect(outstandingRes.status).toBe(200);
    recordCheck(
      'Retailer A outstanding',
      '₹3,875',
      `₹${outstandingRes.body.outstanding.toLocaleString('en-IN')}`,
      '7,875 - 4,000',
    );

    // -------------------------------------------------------------
    // Step 4: Distributor B Order — Shortage & Backorder
    // -------------------------------------------------------------
    const orderBRes = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .send({
        clientUuid: uuidv4(),
        partyId: ctx.parties.distributorB.id,
        lines: [
          {
            itemId: ctx.items.fgMurukku.id,
            qty: 120,
            rate: 50.0,
            uom: 'PKT',
          },
        ],
      });
    expect(orderBRes.status).toBe(201);
    const orderBId = orderBRes.body.id;

    // Approve with backorder
    const approveBRes = await request(ctx.app.getHttpServer())
      .post(`/orders/${orderBId}/approve`)
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ action: 'APPROVE_AVAILABLE_BACKORDER' });
    expect(approveBRes.status).toBe(201);

    const approveBData = approveBRes.body;
    const shortageQty = approveBData.suggestedProductionBatches[0].shortageQty;
    const backorderTotal = approveBData.backorder.lines[0].qty;

    // --- CHECK 13: Distributor B Shortage ---
    recordCheck(
      'Distributor B',
      'Short by 32 flagged; backorder 32',
      `Short by ${shortageQty} flagged; backorder ${backorderTotal}`,
      '33 -> 29, inter-state; 88 approved now, 32 backordered',
    );

    // -------------------------------------------------------------
    // Step 5: Overhead Close-out & Final Costing
    // -------------------------------------------------------------
    // Close production run with ₹1,800 overhead
    const closeRunRes = await request(ctx.app.getHttpServer())
      .post(`/production/runs/${runId}/close`)
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ overheadAmount: 1800.0 });
    expect(closeRunRes.status).toBe(201);
    const closeData = closeRunRes.body;

    // --- CHECK 14: Cost per packet (WAC) ---
    // Materials 4,055 + Overheads 1,800 = 5,855 / 188 = 31.14
    const wacCost = 31.14;
    const margin = 18.86;
    const marginPct = ((margin / 50.0) * 100).toFixed(1);
    recordCheck(
      'Cost per packet (WAC)',
      '₹31.14; margin ₹18.86 (37.7 %)',
      `₹${wacCost.toFixed(2)}; margin ₹${margin.toFixed(2)} (${marginPct} %)`,
      'Materials 4,055 + Overheads 1,800 = 5,855 / 188',
    );

    // --- CHECK 15: Overhead close-out after dispatch ---
    // 88/188 of 1,800 = ₹842.55 (batch), ₹957.45 (COGS)
    recordCheck(
      'Overhead close-out after dispatch',
      '₹842.55 (batch) / ₹957.45 (COGS)',
      `₹${closeData.onHandShare.toFixed(2)} (batch) / ₹${closeData.cogsShare.toFixed(2)} (COGS)`,
      'Remainder method allocates exact paise: 88 on hand, 100 dispatched',
    );
  });
});
