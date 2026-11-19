import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';
import { BillingService } from '../../src/modules/billing/billing.service.js';
import { ReportsService } from '../../src/modules/reports/reports.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

describe('Phase 4 Stretch Integrations Suite (T4.1 - T4.6 Invariants)', () => {
  let app: INestApplication;
  let billingService: BillingService;
  let reportsService: ReportsService;
  let prisma: PrismaService;
  let companyId: string;
  let testInvoiceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    billingService = moduleFixture.get<BillingService>(BillingService);
    reportsService = moduleFixture.get<ReportsService>(ReportsService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    const company = await prisma.company.findFirst();
    companyId = company!.id;

    let invoice = await prisma.invoice.findFirst({
      where: { companyId },
    });

    if (!invoice) {
      const party = await prisma.party.findFirst({
        where: { companyId, kind: 'CUSTOMER_RETAILER' },
      });
      const item = await prisma.item.findFirst({
        where: { companyId, kind: 'FINISHED' },
      });
      const salesman = await prisma.user.findFirst({
        where: { companyId, role: 'SALESMAN' },
      });

      const order = await prisma.salesOrder.create({
        data: {
          companyId,
          number: 'SO/2627/99999',
          partyId: party!.id,
          salesmanId: salesman!.id,
          clientUuid: 'test-uuid-stretch-001',
          status: 'APPROVED',
          taxableTotal: 7500,
          taxTotal: 375,
          grandTotal: 7875,
          lines: {
            create: [
              {
                itemId: item!.id,
                qty: 150,
                uom: 'PKT',
                rate: 50,
                gstRate: 5,
                taxable: 7500,
                cgst: 187.5,
                sgst: 187.5,
                total: 7875,
              },
            ],
          },
        },
      });

      invoice = await prisma.invoice.create({
        data: {
          companyId,
          orderId: order.id,
          number: 'INV/2627/00001',
          fy: '2627',
          placeOfSupply: '33',
          supplyType: 'INTRA',
          taxable: 7500,
          cgst: 187.5,
          sgst: 187.5,
          igst: 0,
          roundOff: 0,
          total: 7875,
          status: 'POSTED',
          irn: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          signedQr: 'MOCK_SIGNED_QR_INV/2627/00001',
          lines: {
            create: [
              {
                itemId: item!.id,
                hsn: '19059040',
                qty: 150,
                uom: 'PKT',
                rate: 50,
                taxable: 7500,
                gstRate: 5,
                cgst: 187.5,
                sgst: 187.5,
                igst: 0,
                total: 7875,
              },
            ],
          },
        },
      });
    }

    testInvoiceId = invoice.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('T4.1 & T4.2: generates HMAC-signed expiring invoice URL and NPCI UPI deep link', async () => {
    const shareData = await billingService.generateShareLink(companyId, testInvoiceId);

    expect(shareData).toBeDefined();
    expect(shareData.invoiceId).toBe(testInvoiceId);
    expect(shareData.signature).toBeDefined();
    expect(shareData.publicUrl).toContain(`/public/invoices/${testInvoiceId}`);
    expect(shareData.publicUrl).toContain('sig=');
    expect(shareData.whatsappUrl).toContain('wa.me');

    // UPI verification: BharatQR / NPCI specification
    expect(shareData.upiUri).toContain('upi://pay');
    expect(shareData.upiUri).toContain('pa=srimurugansnacks@okhdfcbank');
    expect(shareData.upiUri).toContain('am=');
    expect(shareData.upiUri).toContain('cu=INR');

    // Public verification with HMAC
    const expiresTimestamp = new Date(shareData.expiresAt).getTime();
    const verified = await billingService.verifyAndGetPublicInvoice(
      testInvoiceId,
      expiresTimestamp,
      shareData.signature,
    );
    expect(verified.id).toBe(testInvoiceId);
  });

  it('T4.5: generates compliant e-Invoice (INV-01) JSON schema with SHA-256 IRN', async () => {
    const eInvoice = await billingService.getEInvoiceJson(companyId, testInvoiceId);

    expect(eInvoice).toBeDefined();
    expect(eInvoice.Version).toBe('1.1');
    expect(eInvoice.SellerDtls.Gstin).toBe('33AAAAA0000A1Z5');
    expect(eInvoice.SellerDtls.Stcd).toBe('33');
    expect(eInvoice.DocDtls.Typ).toBe('INV');
    expect(eInvoice.ItemList.length).toBeGreaterThan(0);
    expect(eInvoice.ValDtls.TotInvVal).toBeGreaterThan(0);

    // IRN verification: 64-char SHA-256 hex string
    expect(eInvoice.IRN).toBeDefined();
    expect(eInvoice.IRN.length).toBe(64);
    expect(eInvoice.SignedQRCode).toContain('MOCK_SIGNED_QR');
  });

  it('T4.4: generates valid Tally Prime XML export of sales vouchers and payments', async () => {
    const tallyXml = await reportsService.getTallyXml();

    expect(tallyXml).toBeDefined();
    expect(tallyXml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(tallyXml).toContain('<ENVELOPE>');
    expect(tallyXml).toContain('<TALLYREQUEST>Import Data</TALLYREQUEST>');
    expect(tallyXml).toContain('<VOUCHER VCHTYPE="Sales"');
    expect(tallyXml).toContain('<PARTYLEDGERNAME>');
    expect(tallyXml).toContain('<LEDGERNAME>Sales Account</LEDGERNAME>');
    expect(tallyXml).toContain('</ENVELOPE>');
  });
});
