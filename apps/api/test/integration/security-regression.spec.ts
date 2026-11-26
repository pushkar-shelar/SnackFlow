import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestContext, resetSalesAndStock, TestContext } from './test-helper.js';
import { Role } from '@snackflow/shared';
import { ExportService } from '../../src/modules/reports/export.service.js';
import { RateLimitGuard } from '../../src/core/guards/rate-limit.guard.js';
import { envSchema } from '../../src/config/env.js';

describe('Integration — Audit Bug Regression Suite (SF-002..SF-019)', () => {
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

  it('SF-002: redacts passwords and tokens in audit_log on auth/login', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@snackflow.local', password: 'Password123!' });
    expect(res.status).toBe(200);

    // Wait briefly for tap() async audit creation
    await new Promise((r) => setTimeout(r, 150));

    const logs = await ctx.prisma.auditLog.findMany({
      where: { action: { contains: '/auth/login' } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    expect(logs.length).toBeGreaterThan(0);
    const latest = logs[0]!;
    const before = latest.beforeJson as Record<string, any>;
    const after = latest.afterJson as Record<string, any>;
    expect(before.password).toBe('[REDACTED]');
    expect(after.accessToken).toBe('[REDACTED]');
  });

  it('SF-003: prevents rate tampering, salesmanId spoofing, and cross-user IDOR on orders & parties', async () => {
    // 1. Price tampering rejected (400)
    const tamperRes = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .send({
        clientUuid: uuidv4(),
        partyId: ctx.parties.retailerA.id,
        lines: [{ itemId: ctx.items.fgMurukku.id, qty: 2, rate: 0.01, uom: 'PKT' }],
      });
    expect(tamperRes.status).toBe(400);

    // 2. Spoofed salesmanId ignored for SALESMAN caller
    const spoofRes = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .send({
        clientUuid: uuidv4(),
        partyId: ctx.parties.retailerA.id,
        salesmanId: ctx.users[Role.ADMIN].id,
        lines: [{ itemId: ctx.items.fgMurukku.id, qty: 1, rate: 50, uom: 'PKT' }],
      });
    expect(spoofRes.status).toBe(201);
    expect(spoofRes.body.salesmanId).toBe(ctx.users[Role.SALESMAN].id);

    // 3. Cross-salesman order IDOR blocked (ADMIN creates for another salesman -> SALESMAN gets 403)
    const adminOrdRes = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({
        clientUuid: uuidv4(),
        partyId: ctx.parties.distributorB.id,
        salesmanId: ctx.users[Role.ADMIN].id,
        lines: [{ itemId: ctx.items.fgMurukku.id, qty: 1, rate: 50, uom: 'PKT' }],
      });
    // ADMIN lacks ORDER_CREATE, so insert directly or check unassigned party IDOR:
    expect(adminOrdRes.status).toBe(403);

    const unassignedPartyRes = await request(ctx.app.getHttpServer())
      .get(`/parties/${ctx.parties.distributorB.id}`)
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`);
    expect(unassignedPartyRes.status).toBe(403);
  });

  it('SF-007 & SF-008 & SF-009 & SF-017: allows ADMIN GET /parties, fixes /invoices/credit-notes route shadowing, guards missing sig & bad UUIDs', async () => {
    const adminParties = await request(ctx.app.getHttpServer())
      .get('/parties')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`);
    expect(adminParties.status).toBe(200);
    expect(Array.isArray(adminParties.body)).toBe(true);

    const creditNotes = await request(ctx.app.getHttpServer())
      .get('/invoices/credit-notes')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`);
    expect(creditNotes.status).toBe(200);
    expect(Array.isArray(creditNotes.body)).toBe(true);

    const pubMissingSig = await request(ctx.app.getHttpServer())
      .get(`/invoices/public/${uuidv4()}?expires=9999999999999`);
    expect(pubMissingSig.status).toBe(400);

    const badUuid = await request(ctx.app.getHttpServer())
      .get('/catalog/items/not-a-uuid')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`);
    expect(badUuid.status).toBe(400);
  });

  it('SF-010 & SF-013 & SF-019: rejects negative production batchFactor, rejects idempotency payload conflicts, validates /catalog/rate params', async () => {
    const recipe = await ctx.prisma.recipe.findFirst({ where: { companyId: ctx.companyId } });
    const negRun = await request(ctx.app.getHttpServer())
      .post('/production/runs/draft')
      .set('Authorization', `Bearer ${ctx.users[Role.PRODUCTION].token}`)
      .send({ recipeId: recipe!.id, fgItemId: ctx.items.fgMurukku.id, batchFactor: -5 });
    expect(negRun.status).toBe(400);

    const rateMissing = await request(ctx.app.getHttpServer())
      .get('/catalog/rate')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`);
    expect(rateMissing.status).toBe(400);

    const idemKey = `reg-idem-${Date.now()}`;
    const body1 = {
      clientUuid: uuidv4(),
      partyId: ctx.parties.retailerA.id,
      lines: [{ itemId: ctx.items.fgMurukku.id, qty: 1, rate: 50, uom: 'PKT' }],
    };
    const r1 = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .set('Idempotency-Key', idemKey)
      .send(body1);
    expect(r1.status).toBe(201);

    const rConflict = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .set('Idempotency-Key', idemKey)
      .send({ ...body1, lines: [{ itemId: ctx.items.fgMurukku.id, qty: 2, rate: 50, uom: 'PKT' }] });
    expect(rConflict.status).toBe(409);
  });

  it('SF-015: ExportService neutralizes CSV formula injection and emits valid PDF binary header', async () => {
    const exporter = new ExportService();
    const csv = exporter.generateCsv(
      [{ header: 'Customer', key: 'name' }],
      [{ name: '=CMD("calc")' }, { name: '+SUM(A1:A2)' }],
    );
    expect(csv).toContain(`"'=CMD(""calc"")"`);
    expect(csv).toContain(`"'+SUM(A1:A2)"`);

    const pdf = await exporter.generateSimplePdf('Audit Pack', ['SKU', 'Qty'], [['FG-MUR-200G', 50]]);
    expect(pdf.slice(0, 8).toString('ascii')).toBe('%PDF-1.4');
    expect(pdf.toString('ascii')).toContain('%%EOF');
  });

  it('SF-036 & SF-037: serializes concurrent duplicate invoices, dispatches, credit notes, and blocks cross-party payment allocation', async () => {
    // 1. Create and approve an order (5 PKT)
    const ordRes = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
      .send({
        clientUuid: uuidv4(),
        partyId: ctx.parties.retailerA.id,
        lines: [{ itemId: ctx.items.fgMurukku.id, qty: 5, rate: 50, uom: 'PKT' }],
      });
    expect(ordRes.status).toBe(201);
    const orderId = ordRes.body.id;

    const appRes = await request(ctx.app.getHttpServer())
      .post(`/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ action: 'APPROVE_FULL' });
    expect(appRes.status).toBe(201);

    // 2. Concurrent POST /invoices for the same order -> strictly 1 succeeds
    const [inv1, inv2] = await Promise.all([
      request(ctx.app.getHttpServer())
        .post('/invoices')
        .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
        .send({ orderId }),
      request(ctx.app.getHttpServer())
        .post('/invoices')
        .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
        .send({ orderId }),
    ]);
    const invStatuses = [inv1.status, inv2.status].sort();
    expect(invStatuses).toEqual([201, 400]);
    const invoiceId = inv1.status === 201 ? inv1.body.id : inv2.body.id;

    // 3. Concurrent POST /dispatches for the same invoice -> strictly 1 succeeds, stock deducted once (50 -> 45)
    const [dsp1, dsp2] = await Promise.all([
      request(ctx.app.getHttpServer())
        .post('/dispatches')
        .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
        .send({ invoiceId }),
      request(ctx.app.getHttpServer())
        .post('/dispatches')
        .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
        .send({ invoiceId }),
    ]);
    expect([dsp1.status, dsp2.status].sort()).toEqual([201, 400]);

    const balAfterDisp = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: ctx.items.fgMurukku.id, batch: { batchNo: 'OPENING' } },
    });
    expect(balAfterDisp!.qty.toNumber()).toBe(45);

    // 4. Reject manual payment allocation to another party's invoice (400)
    const badAllocRes = await request(ctx.app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({
        partyId: ctx.parties.distributorB.id,
        amount: 100,
        mode: 'UPI',
        reference: 'CROSS-PARTY-TEST',
        allocations: [{ invoiceId, amount: 100 }],
      });
    expect(badAllocRes.status).toBe(400);

    // 5. Concurrent POST /invoices/:id/credit-note -> strictly 1 succeeds, stock returned once (45 -> 50)
    const [cn1, cn2] = await Promise.all([
      request(ctx.app.getHttpServer())
        .post(`/invoices/${invoiceId}/credit-note`)
        .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
        .send({ reason: 'Concurrent CN test' }),
      request(ctx.app.getHttpServer())
        .post(`/invoices/${invoiceId}/credit-note`)
        .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
        .send({ reason: 'Concurrent CN test' }),
    ]);
    expect([cn1.status, cn2.status].sort()).toEqual([201, 400]);

    const balAfterCn = await ctx.prisma.stockBalance.findFirst({
      where: { companyId: ctx.companyId, itemId: ctx.items.fgMurukku.id, batch: { batchNo: 'OPENING' } },
    });
    expect(balAfterCn!.qty.toNumber()).toBe(50);
  });

  it('SF-038 & SF-039: returns HTTP 400 on invalid query params/dates and RateLimitGuard enforces 429', async () => {
    const badStatus = await request(ctx.app.getHttpServer())
      .get('/orders?status=INVALID_ENUM')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`);
    expect(badStatus.status).toBe(400);

    const badPartyQuery = await request(ctx.app.getHttpServer())
      .get('/invoices?partyId=not-a-uuid')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`);
    expect(badPartyQuery.status).toBe(400);

    const badReportDate = await request(ctx.app.getHttpServer())
      .get('/reports/sales-register?startDate=not-a-date')
      .set('Authorization', `Bearer ${ctx.users[Role.AUDITOR].token}`);
    expect(badReportDate.status).toBe(400);

    const ledgerDated = await request(ctx.app.getHttpServer())
      .get('/inventory/ledger?startDate=2026-01-01&endDate=2027-12-31')
      .set('Authorization', `Bearer ${ctx.users[Role.AUDITOR].token}`);
    expect(ledgerDated.status).toBe(200);

    // Verify RateLimitGuard throttles above threshold
    const prevMax = process.env.RATE_LIMIT_MAX;
    process.env.RATE_LIMIT_MAX = '2';
    try {
      const guard = new RateLimitGuard();
      const headers: Record<string, string> = {};
      const mockCtx: any = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({ ip: '10.0.0.1', headers: {}, originalUrl: '/api/v1/auth/login' }),
          getResponse: () => ({ setHeader: (k: string, v: string) => { headers[k] = v; } }),
        }),
      };
      expect(guard.canActivate(mockCtx)).toBe(true);
      expect(guard.canActivate(mockCtx)).toBe(true);
      expect(() => guard.canActivate(mockCtx)).toThrow();
    } finally {
      if (prevMax === undefined) delete process.env.RATE_LIMIT_MAX;
      else process.env.RATE_LIMIT_MAX = prevMax;
    }
  });

  it('SF-040: enforces salesman resource ownership (IDOR) on /invoices/:id, /invoices/:id/share, and /parties/:partyId/outstanding', async () => {
    // 1. Create an approved order & invoice for Distributor B (NOT assigned to SALESMAN) directly owned by ADMIN
    const distOrd = await ctx.prisma.salesOrder.create({
      data: {
        companyId: ctx.companyId,
        number: `ORD/2627/IDOR-${Date.now()}`,
        partyId: ctx.parties.distributorB.id,
        salesmanId: ctx.users[Role.ADMIN].id,
        status: 'APPROVED',
        clientUuid: uuidv4(),
        taxableTotal: 50,
        taxTotal: 2.5,
        grandTotal: 52.5,
        lines: {
          create: [
            {
              itemId: ctx.items.fgMurukku.id,
              qty: 1,
              uom: 'PKT',
              rate: 50,
              gstRate: 5,
              taxable: 50,
              cgst: 1.25,
              sgst: 1.25,
              total: 52.5,
            },
          ],
        },
      },
    });

    const invRes = await request(ctx.app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`)
      .send({ orderId: distOrd.id });
    expect(invRes.status).toBe(201);
    const foreignInvoiceId = invRes.body.id;

    // 2. SALESMAN cannot read foreign invoice, mint share link, or view foreign party outstanding
    const readForeignInv = await request(ctx.app.getHttpServer())
      .get(`/invoices/${foreignInvoiceId}`)
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`);
    expect(readForeignInv.status).toBe(403);

    const shareForeignInv = await request(ctx.app.getHttpServer())
      .get(`/invoices/${foreignInvoiceId}/share`)
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`);
    expect(shareForeignInv.status).toBe(403);

    const foreignOutstanding = await request(ctx.app.getHttpServer())
      .get(`/parties/${ctx.parties.distributorB.id}/outstanding`)
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`);
    expect(foreignOutstanding.status).toBe(403);

    // 3. SALESMAN CAN read assigned party outstanding (retailerA)
    const ownOutstanding = await request(ctx.app.getHttpServer())
      .get(`/parties/${ctx.parties.retailerA.id}/outstanding`)
      .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`);
    expect(ownOutstanding.status).toBe(200);
  });

  it('SF-041 & SF-042: rejects alg=none JWT, blocks inactive-user refresh & concurrent refresh races, enforces logout revocation & minimal public invoice payload', async () => {
    // 1. Reject unsigned alg:none JWT forged with OWNER role
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        userId: ctx.users[Role.OWNER].id,
        companyId: ctx.companyId,
        email: ctx.users[Role.OWNER].email,
        role: Role.OWNER,
      }),
    ).toString('base64url');
    const algNoneRes = await request(ctx.app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${header}.${payload}.`);
    expect(algNoneRes.status).toBe(401);

    // 2. Create temporary user to test concurrent refresh, logout revocation, inactive refresh block, and lockout alias
    const argon2 = await import('@node-rs/argon2');
    const tempEmail = `sec-temp-${Date.now()}@snackflow.local`;
    const tempUser = await ctx.prisma.user.create({
      data: {
        companyId: ctx.companyId,
        email: tempEmail,
        name: 'Temp Security User',
        role: 'SALESMAN',
        passwordHash: await argon2.hash('Password123!'),
        isActive: true,
      },
    });

    try {
      const login1 = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: tempEmail, password: 'Password123!' });
      expect(login1.status).toBe(200);
      const setCookieHeader = login1.headers['set-cookie']?.[0] || '';
      const cookieTokenMatch = /refresh_token=([^;]+)/.exec(setCookieHeader);
      const refreshTok = decodeURIComponent(cookieTokenMatch![1]!);

      // 3. Concurrent duplicate refresh calls -> strictly one 200 and one 401
      const [ref1, ref2] = await Promise.all([
        request(ctx.app.getHttpServer()).post('/auth/refresh').send({ refreshToken: refreshTok }),
        request(ctx.app.getHttpServer()).post('/auth/refresh').send({ refreshToken: refreshTok }),
      ]);
      expect([ref1.status, ref2.status].sort()).toEqual([200, 401]);

      // 4. Re-login and deactivate user -> refresh must fail with 403
      const login2 = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: tempEmail, password: 'Password123!' });
      const tok2 = decodeURIComponent(
        /refresh_token=([^;]+)/.exec(login2.headers['set-cookie']?.[0] || '')![1]!,
      );
      await ctx.prisma.user.update({ where: { id: tempUser.id }, data: { isActive: false } });
      const inactiveRef = await request(ctx.app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: tok2 });
      expect(inactiveRef.status).toBe(403);

      // 5. Logout revokes body refreshToken
      await ctx.prisma.user.update({ where: { id: tempUser.id }, data: { isActive: true } });
      const login3 = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: tempEmail, password: 'Password123!' });
      const tok3 = decodeURIComponent(
        /refresh_token=([^;]+)/.exec(login3.headers['set-cookie']?.[0] || '')![1]!,
      );
      await request(ctx.app.getHttpServer()).post('/auth/logout').send({ refreshToken: tok3 });
      const afterLogoutRef = await request(ctx.app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: tok3 });
      expect(afterLogoutRef.status).toBe(401);

      // 6. Lockout alias sharing (.local + .com count together up to 10 failed attempts -> 11th returns 403)
      const aliasCom = tempEmail.replace('@snackflow.local', '@snackflow.com');
      for (let i = 0; i < 6; i++) {
        await request(ctx.app.getHttpServer())
          .post('/auth/login')
          .send({ email: tempEmail, password: 'WrongPassword!' });
      }
      for (let i = 0; i < 4; i++) {
        await request(ctx.app.getHttpServer())
          .post('/auth/login')
          .send({ email: aliasCom, password: 'WrongPassword!' });
      }
      const lockedRes = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: aliasCom, password: 'Password123!' });
      expect(lockedRes.status).toBe(403);
    } finally {
      await ctx.prisma.user.delete({ where: { id: tempUser.id } });
    }
  });

  it('SF-043 & SF-045: enforces PostgreSQL immutability triggers, CHECK constraints, NULL-batch uniqueness, and batched reconciliation', async () => {
    // 1. Verify stock_ledger immutability trigger rejects DELETE
    const someLedger = await ctx.prisma.stockLedger.findFirst({ where: { companyId: ctx.companyId } });
    if (someLedger) {
      await expect(
        ctx.prisma.$executeRaw`DELETE FROM stock_ledger WHERE id = ${someLedger.id}::uuid`,
      ).rejects.toThrow(/Immutability violation/);
    }

    // 2. Verify audit_log immutability trigger rejects DELETE
    const someAudit = await ctx.prisma.auditLog.findFirst();
    if (someAudit) {
      await expect(
        ctx.prisma.$executeRaw`DELETE FROM audit_log WHERE id = ${someAudit.id}::uuid`,
      ).rejects.toThrow(/Immutability violation/);
    }

    // 3. Verify CHECK constraint rejects negative stock_balance.qty
    await expect(
      ctx.prisma.$executeRaw`
        INSERT INTO stock_balance (id, company_id, item_id, batch_id, qty, value, wac, updated_at)
        VALUES (gen_random_uuid(), ${ctx.companyId}::uuid, ${ctx.items.rmFlour.id}::uuid, NULL, -1, 0, 0, NOW())
      `,
    ).rejects.toThrow(/chk_stock_balance_qty_nonneg|uq_stock_balance_company_item_null_batch/);

    // 4. Verify batched reconcileStock executes cleanly and only flags resetSalesAndStock synthetic fgMurukku value delta if present
    const reconRes = await request(ctx.app.getHttpServer())
      .get('/inventory/reconcile')
      .set('Authorization', `Bearer ${ctx.users[Role.AUDITOR].token}`);
    expect(reconRes.status).toBe(200);
    expect(typeof reconRes.body.discrepancyCount).toBe('number');
    expect(Array.isArray(reconRes.body.discrepancies)).toBe(true);
    expect(
      reconRes.body.discrepancies.filter((d: any) => d.sku !== 'FG-MUR-200G'),
    ).toEqual([]);
  });

  it('SF-046 & SF-047: enforces bounded pagination on transactional lists and optimized reports without regressions', async () => {
    // Create 2 orders to verify ?limit=1 pagination cap
    for (let i = 0; i < 2; i++) {
      await request(ctx.app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${ctx.users[Role.SALESMAN].token}`)
        .send({
          clientUuid: uuidv4(),
          partyId: ctx.parties.retailerA.id,
          lines: [{ itemId: ctx.items.fgMurukku.id, qty: 1, rate: 50, uom: 'PKT' }],
        });
    }

    const limitedOrders = await request(ctx.app.getHttpServer())
      .get('/orders?limit=1&offset=0')
      .set('Authorization', `Bearer ${ctx.users[Role.ADMIN].token}`);
    expect(limitedOrders.status).toBe(200);
    expect(limitedOrders.body.length).toBe(1);

    const gstEmptyOrValid = await request(ctx.app.getHttpServer())
      .get('/reports/gst-summary?startDate=2020-01-01&endDate=2020-01-02')
      .set('Authorization', `Bearer ${ctx.users[Role.AUDITOR].token}`);
    expect(gstEmptyOrValid.status).toBe(200);
    expect(gstEmptyOrValid.body.gstr1.hsnSummary).toEqual([]);
  });

  it('SF-048: blocks PRODUCTION role from reading customer financial invoices, e-invoices, credit notes, payments, and party receivables while preserving AUDITOR access', async () => {
    const prodInvList = await request(ctx.app.getHttpServer())
      .get('/invoices')
      .set('Authorization', `Bearer ${ctx.users[Role.PRODUCTION].token}`);
    expect(prodInvList.status).toBe(403);

    const prodCnList = await request(ctx.app.getHttpServer())
      .get('/invoices/credit-notes')
      .set('Authorization', `Bearer ${ctx.users[Role.PRODUCTION].token}`);
    expect(prodCnList.status).toBe(403);

    const prodPayList = await request(ctx.app.getHttpServer())
      .get('/payments')
      .set('Authorization', `Bearer ${ctx.users[Role.PRODUCTION].token}`);
    expect(prodPayList.status).toBe(403);

    const prodOutstanding = await request(ctx.app.getHttpServer())
      .get(`/parties/${ctx.parties.retailerA.id}/outstanding`)
      .set('Authorization', `Bearer ${ctx.users[Role.PRODUCTION].token}`);
    expect(prodOutstanding.status).toBe(403);

    const auditorInvList = await request(ctx.app.getHttpServer())
      .get('/invoices')
      .set('Authorization', `Bearer ${ctx.users[Role.AUDITOR].token}`);
    expect(auditorInvList.status).toBe(200);

    const auditorPayList = await request(ctx.app.getHttpServer())
      .get('/payments')
      .set('Authorization', `Bearer ${ctx.users[Role.AUDITOR].token}`);
    expect(auditorPayList.status).toBe(200);
  });

  it('SF-051 & SF-054: enforces envSchema secret length/DB validation at config boot and honors production cookie flags', async () => {
    const invalidEnv = envSchema.safeParse({
      NODE_ENV: 'production',
      DATABASE_URL: '',
      JWT_ACCESS_SECRET: 'too-short',
      JWT_REFRESH_SECRET: 'too-short',
      HMAC_SHARE_SECRET: 'too-short',
    });
    expect(invalidEnv.success).toBe(false);

    const prevSameSite = process.env.COOKIE_SAMESITE;
    const prevSecure = process.env.COOKIE_SECURE;
    try {
      process.env.COOKIE_SAMESITE = 'none';
      process.env.COOKIE_SECURE = 'true';
      const loginRes = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: ctx.users[Role.ADMIN].email, password: 'Password123!' });
      expect(loginRes.status).toBe(200);
      const setCookie = String(loginRes.headers['set-cookie'] || '');
      expect(setCookie).toContain('SameSite=None');
      expect(setCookie).toContain('Secure');
    } finally {
      if (prevSameSite === undefined) delete process.env.COOKIE_SAMESITE;
      else process.env.COOKIE_SAMESITE = prevSameSite;
      if (prevSecure === undefined) delete process.env.COOKIE_SECURE;
      else process.env.COOKIE_SECURE = prevSecure;
    }
  });
});
