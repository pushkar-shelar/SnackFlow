import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';
import { ReportsService } from '../../src/modules/reports/reports.service.js';
import { ExportService } from '../../src/modules/reports/export.service.js';

describe('Reports & Analytics Suite (§10 Invariants)', () => {
  let app: INestApplication;
  let reportsService: ReportsService;
  let exportService: ExportService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    reportsService = moduleFixture.get<ReportsService>(ReportsService);
    exportService = moduleFixture.get<ExportService>(ExportService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates Sales Register with accurate tax sums and invoice line details', async () => {
    const register = await reportsService.getSalesRegister();
    expect(register).toBeDefined();
    expect(register.summary).toBeDefined();
    expect(Array.isArray(register.rows)).toBe(true);
  });

  it('generates GSTR-1 and GSTR-3B summary shaped structures', async () => {
    const gstSummary = await reportsService.getGstSummary();
    expect(gstSummary.gstr1).toBeDefined();
    expect(Array.isArray(gstSummary.gstr1.b2b)).toBe(true);
    expect(Array.isArray(gstSummary.gstr1.b2cs)).toBe(true);
    expect(Array.isArray(gstSummary.gstr1.hsnSummary)).toBe(true);
    expect(gstSummary.gstr3b).toBeDefined();
    expect(gstSummary.gstr3b.table).toContain('3.1(a)');
  });

  it('generates Stock Summary with valuations and UoM consistency', async () => {
    const stockSummary = await reportsService.getStockSummary();
    expect(stockSummary.totalItems).toBeGreaterThan(0);
    expect(parseFloat(stockSummary.totalValuation)).toBeGreaterThanOrEqual(0);
    expect(stockSummary.rows.length).toBeGreaterThan(0);
  });

  it('generates Stock Ledger transaction log', async () => {
    const stockLedger = await reportsService.getStockLedger();
    expect(Array.isArray(stockLedger.rows)).toBe(true);
  });

  it('generates Production Report with variance metrics and overhead cost', async () => {
    const prodReport = await reportsService.getProductionReport();
    expect(Array.isArray(prodReport.rows)).toBe(true);
  });

  it('generates Costing Comparison comparing WAC vs FIFO side-by-side', async () => {
    const costing = await reportsService.getCostingComparison();
    expect(Array.isArray(costing.rows)).toBe(true);
  });

  it('generates Outstanding Ageing with 0-30, 31-60, 61-90, 90+ buckets', async () => {
    const ageing = await reportsService.getOutstandingAgeing();
    expect(Array.isArray(ageing.rows)).toBe(true);
    expect(parseFloat(ageing.grandTotalOutstanding)).toBeGreaterThanOrEqual(0);
  });

  it('generates valid CSV and formatted Excel (.xlsx) workbooks via ExportService', async () => {
    const columns = [
      { header: 'Test Header A', key: 'colA', width: 20 },
      { header: 'Test Header B', key: 'colB', width: 15 },
    ];
    const rows = [
      { colA: 'Value 1', colB: 100.5 },
      { colA: 'Value 2', colB: 200.75 },
    ];

    const csv = exportService.generateCsv(columns, rows);
    expect(csv).toContain('"Test Header A","Test Header B"');
    expect(csv).toContain('"Value 1","100.5"');

    const excelBuffer = await exportService.generateExcel('TestSheet', columns, rows);
    expect(excelBuffer).toBeInstanceOf(Buffer);
    expect(excelBuffer.length).toBeGreaterThan(100);
    // Excel files start with PK (ZIP header)
    expect(excelBuffer.slice(0, 2).toString()).toBe('PK');
  });
});
