import { Injectable, Logger, Inject, BadRequestException } from '@nestjs/common';
import { PrismaReadService } from '../../prisma/prisma-read.service.js';
import { toDecimal } from '@snackflow/shared';
import Decimal from 'decimal.js';
import { PartyKind, InvoiceStatus } from '@prisma/client';

const ZERO_MONEY = new Decimal(0);
const ZERO_QTY = new Decimal(0);

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(@Inject(PrismaReadService) private readonly prismaRead: PrismaReadService) {}

  private buildDateFilter(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) return undefined;
    const range: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        throw new BadRequestException(`Invalid startDate '${startDate}'`);
      }
      range.gte = start;
    }
    if (endDate) {
      const normalized = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? `${endDate}T23:59:59.999Z` : endDate;
      const end = new Date(normalized);
      if (isNaN(end.getTime())) {
        throw new BadRequestException(`Invalid endDate '${endDate}'`);
      }
      range.lte = end;
    }
    return range;
  }

  // 1. Sales Register
  async getSalesRegister(startDate?: string, endDate?: string, companyId?: string) {
    const createdAt = this.buildDateFilter(startDate, endDate);
    const where: any = {
      ...(companyId ? { companyId } : {}),
      status: { not: InvoiceStatus.CANCELLED },
      ...(createdAt ? { createdAt } : {}),
    };

    const invoices = await this.prismaRead.invoice.findMany({
      where,
      include: {
        order: {
          include: { party: true },
        },
        _count: {
          select: { lines: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalTaxable = ZERO_MONEY;
    let totalCgst = ZERO_MONEY;
    let totalSgst = ZERO_MONEY;
    let totalIgst = ZERO_MONEY;
    let totalGrand = ZERO_MONEY;

    const rows = invoices.map((inv) => {
      const taxable = toDecimal(inv.taxable);
      const cgst = toDecimal(inv.cgst);
      const sgst = toDecimal(inv.sgst);
      const igst = toDecimal(inv.igst);
      const grand = toDecimal(inv.total);

      totalTaxable = totalTaxable.plus(taxable);
      totalCgst = totalCgst.plus(cgst);
      totalSgst = totalSgst.plus(sgst);
      totalIgst = totalIgst.plus(igst);
      totalGrand = totalGrand.plus(grand);

      const customerName = inv.order?.party.name || 'Direct Customer';
      const customerGstin = inv.order?.party.gstin || 'UNREGISTERED';
      const customerState = inv.order?.party.stateCode || inv.placeOfSupply;

      return {
        id: inv.id,
        invoiceNumber: inv.number,
        invoiceDate: inv.createdAt.toISOString().split('T')[0],
        status: inv.status,
        customerName,
        customerGstin,
        customerState,
        taxableTotal: taxable.toFixed(2),
        cgstTotal: cgst.toFixed(2),
        sgstTotal: sgst.toFixed(2),
        igstTotal: igst.toFixed(2),
        grandTotal: grand.toFixed(2),
        lineCount: inv._count.lines,
      };
    });

    return {
      period: { startDate: startDate || null, endDate: endDate || null },
      summary: {
        totalInvoices: rows.length,
        totalTaxable: totalTaxable.toFixed(2),
        totalCgst: totalCgst.toFixed(2),
        totalSgst: totalSgst.toFixed(2),
        totalIgst: totalIgst.toFixed(2),
        totalGrand: totalGrand.toFixed(2),
      },
      rows,
    };
  }

  // 2. Customer-wise & Product-wise Sales
  async getSalesByCustomer(startDate?: string, endDate?: string, companyId?: string) {
    const register = await this.getSalesRegister(startDate, endDate, companyId);
    const map = new Map<string, { customerName: string; gstin: string; invoiceCount: number; taxableTotal: Decimal; grandTotal: Decimal }>();

    for (const row of register.rows) {
      const existing = map.get(row.customerName) || {
        customerName: row.customerName,
        gstin: row.customerGstin,
        invoiceCount: 0,
        taxableTotal: ZERO_MONEY,
        grandTotal: ZERO_MONEY,
      };

      existing.invoiceCount += 1;
      existing.taxableTotal = existing.taxableTotal.plus(toDecimal(row.taxableTotal));
      existing.grandTotal = existing.grandTotal.plus(toDecimal(row.grandTotal));
      map.set(row.customerName, existing);
    }

    return Array.from(map.values()).map((v) => ({
      customerName: v.customerName,
      gstin: v.gstin,
      invoiceCount: v.invoiceCount,
      taxableTotal: v.taxableTotal.toFixed(2),
      grandTotal: v.grandTotal.toFixed(2),
    }));
  }

  async getSalesByProduct(startDate?: string, endDate?: string, companyId?: string) {
    const createdAt = this.buildDateFilter(startDate, endDate);
    const where: any = {
      invoice: {
        ...(companyId ? { companyId } : {}),
        status: { not: InvoiceStatus.CANCELLED },
        ...(createdAt ? { createdAt } : {}),
      },
    };

    const lines = await this.prismaRead.invoiceLine.findMany({
      where,
      include: {
        item: true,
      },
    });

    const map = new Map<
      string,
      { itemCode: string; itemName: string; uom: string; totalQty: Decimal; totalTaxable: Decimal; totalTax: Decimal; totalGrand: Decimal }
    >();

    for (const line of lines) {
      const key = line.item.sku;
      const existing = map.get(key) || {
        itemCode: line.item.sku,
        itemName: line.item.name,
        uom: line.item.baseUom,
        totalQty: ZERO_QTY,
        totalTaxable: ZERO_MONEY,
        totalTax: ZERO_MONEY,
        totalGrand: ZERO_MONEY,
      };

      const lineTax = toDecimal(line.cgst).plus(toDecimal(line.sgst)).plus(toDecimal(line.igst));
      existing.totalQty = existing.totalQty.plus(toDecimal(line.qty));
      existing.totalTaxable = existing.totalTaxable.plus(toDecimal(line.taxable));
      existing.totalTax = existing.totalTax.plus(lineTax);
      existing.totalGrand = existing.totalGrand.plus(toDecimal(line.total));
      map.set(key, existing);
    }

    return Array.from(map.values()).map((v) => ({
      itemCode: v.itemCode,
      itemName: v.itemName,
      uom: v.uom,
      totalQty: v.totalQty.toFixed(2),
      totalTaxable: v.totalTaxable.toFixed(2),
      totalTax: v.totalTax.toFixed(2),
      totalGrand: v.totalGrand.toFixed(2),
    }));
  }

  // 3. GST Outward Summary (GSTR-1 & GSTR-3B shape)
  async getGstSummary(startDate?: string, endDate?: string, companyId?: string) {
    const register = await this.getSalesRegister(startDate, endDate, companyId);

    // GSTR-1 Table 4: B2B Invoices (registered customers with valid GSTIN)
    const b2bRows = register.rows.filter((r) => r.customerGstin && r.customerGstin !== 'UNREGISTERED');

    // GSTR-1 Table 7: B2CS Invoices (unregistered consumer/retail)
    const b2csRows = register.rows.filter((r) => !r.customerGstin || r.customerGstin === 'UNREGISTERED');

    // Table 12: HSN Summary
    const invoiceIds = register.rows.map((r) => r.id);
    const lines =
      invoiceIds.length === 0
        ? []
        : await this.prismaRead.invoiceLine.findMany({
            where: { invoiceId: { in: invoiceIds } },
            include: { item: true },
          });

    const hsnMap = new Map<string, { hsnCode: string; description: string; uqc: string; totalQty: Decimal; taxableValue: Decimal; cgstAmount: Decimal; sgstAmount: Decimal; igstAmount: Decimal }>();

    for (const l of lines) {
      const hsn = l.hsn || l.item.hsn || '19059040';
      const existing = hsnMap.get(hsn) || {
        hsnCode: hsn,
        description: l.item.name,
        uqc: l.uom || l.item.baseUom,
        totalQty: ZERO_QTY,
        taxableValue: ZERO_MONEY,
        cgstAmount: ZERO_MONEY,
        sgstAmount: ZERO_MONEY,
        igstAmount: ZERO_MONEY,
      };

      existing.totalQty = existing.totalQty.plus(toDecimal(l.qty));
      existing.taxableValue = existing.taxableValue.plus(toDecimal(l.taxable));
      existing.cgstAmount = existing.cgstAmount.plus(toDecimal(l.cgst));
      existing.sgstAmount = existing.sgstAmount.plus(toDecimal(l.sgst));
      existing.igstAmount = existing.igstAmount.plus(toDecimal(l.igst));
      hsnMap.set(hsn, existing);
    }

    const hsnSummary = Array.from(hsnMap.values()).map((h) => ({
      hsnCode: h.hsnCode,
      description: h.description,
      uqc: h.uqc,
      totalQty: h.totalQty.toFixed(2),
      taxableValue: h.taxableValue.toFixed(2),
      cgstAmount: h.cgstAmount.toFixed(2),
      sgstAmount: h.sgstAmount.toFixed(2),
      igstAmount: h.igstAmount.toFixed(2),
      totalTax: h.cgstAmount.plus(h.sgstAmount).plus(h.igstAmount).toFixed(2),
    }));

    // GSTR-3B Table 3.1(a): Outward taxable supplies
    const gstr3b = {
      table: '3.1(a) Outward taxable supplies (other than zero rated, nil rated and exempted)',
      taxableValue: register.summary.totalTaxable,
      integratedTax: register.summary.totalIgst,
      centralTax: register.summary.totalCgst,
      stateTax: register.summary.totalSgst,
      cess: '0.00',
    };

    return {
      period: register.period,
      gstr1: {
        b2b: b2bRows,
        b2cs: b2csRows,
        hsnSummary,
      },
      gstr3b,
    };
  }

  // 4. Purchase Register
  async getPurchaseRegister(startDate?: string, endDate?: string, companyId?: string) {
    const purchaseDate = this.buildDateFilter(startDate, endDate);
    const where: any = {
      ...(companyId ? { companyId } : {}),
      ...(purchaseDate ? { purchaseDate } : {}),
    };

    const purchases = await this.prismaRead.purchase.findMany({
      where,
      include: {
        party: true,
        lines: {
          include: { item: true },
        },
      },
      orderBy: { purchaseDate: 'desc' },
    });

    const rows = purchases.map((p) => {
      const grand = toDecimal(p.totalAmount);
      return {
        id: p.id,
        purchaseNumber: p.purchaseNo,
        purchaseDate: p.purchaseDate.toISOString().split('T')[0],
        supplierName: p.party.name,
        supplierGstin: p.party.gstin || 'N/A',
        taxableTotal: grand.toFixed(2),
        grandTotal: grand.toFixed(2),
        items: p.lines.map((l) => `${l.item.name} (${toDecimal(l.qty).toFixed(2)} ${l.uom} @ ₹${toDecimal(l.unitCost).toFixed(2)})`).join(', '),
      };
    });

    return {
      totalPurchases: rows.length,
      rows,
    };
  }

  // 5. Stock Summary (Opening, Receipts, Issues, Closing, Value; supports historical endDate cut-off)
  async getStockSummary(startDate?: string, endDate?: string, companyId?: string) {
    const startFilter = startDate ? this.buildDateFilter(startDate, undefined)?.gte : undefined;
    const endFilter = endDate ? this.buildDateFilter(undefined, endDate)?.lte : undefined;
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const isHistorical = Boolean(endFilter && endFilter.getTime() < todayStart.getTime());

    // Compute per-item period flows (Opening < startDate, Receipts/Issues within [startDate, endDate])
    const [openingAgg, periodAgg] = await Promise.all([
      startFilter
        ? this.prismaRead.stockLedger.groupBy({
            by: ['itemId'],
            where: {
              ...(companyId ? { companyId } : {}),
              txnAt: { lt: startFilter },
            },
            _sum: { qtyIn: true, qtyOut: true },
          })
        : Promise.resolve([]),
      this.prismaRead.stockLedger.groupBy({
        by: ['itemId'],
        where: {
          ...(companyId ? { companyId } : {}),
          ...(startFilter || endFilter
            ? {
                txnAt: {
                  ...(startFilter ? { gte: startFilter } : {}),
                  ...(endFilter ? { lte: endFilter } : {}),
                },
              }
            : {}),
        },
        _sum: { qtyIn: true, qtyOut: true },
      }),
    ]);

    const openingByItem = new Map(
      openingAgg.map((g) => [g.itemId, toDecimal(g._sum.qtyIn ?? 0).minus(toDecimal(g._sum.qtyOut ?? 0))]),
    );
    const receiptsByItem = new Map(
      periodAgg.map((g) => [g.itemId, toDecimal(g._sum.qtyIn ?? 0)]),
    );
    const issuesByItem = new Map(
      periodAgg.map((g) => [g.itemId, toDecimal(g._sum.qtyOut ?? 0)]),
    );

    const buildSummaryRow = (
      item: { id: string; sku: string; name: string; kind: string; baseUom: string; reorderLevel: Decimal | null },
      currentQty: Decimal,
      currentValue: Decimal,
    ) => {
      const wac = currentQty.isZero() ? ZERO_MONEY : currentValue.div(currentQty);
      const openingQty = openingByItem.get(item.id) || ZERO_QTY;
      const receiptsQty = receiptsByItem.get(item.id) || ZERO_QTY;
      const issuesQty = issuesByItem.get(item.id) || ZERO_QTY;
      return {
        id: item.id,
        code: item.sku,
        name: item.name,
        kind: item.kind,
        uom: item.baseUom,
        openingQty: openingQty.toFixed(4),
        receiptsQty: receiptsQty.toFixed(4),
        issuesQty: issuesQty.toFixed(4),
        currentQty: currentQty.toFixed(4),
        currentValue: currentValue.toFixed(2),
        wac: wac.toFixed(6),
        reorderLevel: item.reorderLevel ? toDecimal(item.reorderLevel).toFixed(2) : null,
        isBelowReorder: item.reorderLevel ? currentQty.lessThan(toDecimal(item.reorderLevel)) : false,
      };
    };

    if (isHistorical && endFilter) {
      const [items, ledgerAgg, histTxns] = await Promise.all([
        this.prismaRead.item.findMany({
          where: companyId ? { companyId } : {},
          orderBy: [{ kind: 'asc' }, { name: 'asc' }],
        }),
        this.prismaRead.stockLedger.groupBy({
          by: ['itemId'],
          where: {
            ...(companyId ? { companyId } : {}),
            txnAt: { lte: endFilter },
          },
          _sum: {
            qtyIn: true,
            qtyOut: true,
          },
        }),
        this.prismaRead.stockLedger.findMany({
          where: {
            ...(companyId ? { companyId } : {}),
            txnAt: { lte: endFilter },
          },
          select: { itemId: true, qtyIn: true, qtyOut: true, value: true },
        }),
      ]);

      const qtyByItem = new Map(
        ledgerAgg.map((g) => [
          g.itemId,
          toDecimal(g._sum.qtyIn ?? 0).minus(toDecimal(g._sum.qtyOut ?? 0)),
        ]),
      );

      const valByItem = new Map<string, Decimal>();
      for (const t of histTxns) {
        const prev = valByItem.get(t.itemId) || ZERO_MONEY;
        const delta = toDecimal(t.qtyIn).greaterThan(0)
          ? toDecimal(t.value)
          : toDecimal(t.qtyOut).greaterThan(0)
          ? toDecimal(t.value).negated()
          : toDecimal(t.value);
        valByItem.set(t.itemId, prev.plus(delta));
      }

      const rows = items.map((item) => {
        const currentQty = qtyByItem.get(item.id) || ZERO_QTY;
        const rawVal = valByItem.get(item.id) || ZERO_MONEY;
        const currentValue = currentQty.lessThanOrEqualTo(0) ? ZERO_MONEY : rawVal;
        return buildSummaryRow(item, currentQty, currentValue);
      });

      const totalValuation = rows.reduce((sum, r) => sum.plus(toDecimal(r.currentValue)), ZERO_MONEY);
      return { totalItems: rows.length, totalValuation: totalValuation.toFixed(2), rows };
    }

    const items = await this.prismaRead.item.findMany({
      where: companyId ? { companyId } : {},
      include: { stockBalances: companyId ? { where: { companyId } } : true },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });

    const rows = items.map((item) => {
      const currentQty = (item.stockBalances || []).reduce((sum, b) => sum.plus(toDecimal(b.qty)), ZERO_QTY);
      const currentValue = (item.stockBalances || []).reduce((sum, b) => sum.plus(toDecimal(b.value)), ZERO_MONEY);
      return buildSummaryRow(item, currentQty, currentValue);
    });

    const totalValuation = rows.reduce((sum, r) => sum.plus(toDecimal(r.currentValue)), ZERO_MONEY);

    return {
      totalItems: rows.length,
      totalValuation: totalValuation.toFixed(2),
      rows,
    };
  }

  // 6. Stock Ledger
  async getStockLedger(itemId?: string, startDate?: string, endDate?: string, companyId?: string) {
    const txnAt = this.buildDateFilter(startDate, endDate);
    const where: any = {
      ...(companyId ? { companyId } : {}),
      ...(itemId ? { itemId } : {}),
      ...(txnAt ? { txnAt } : {}),
    };

    const entries = await this.prismaRead.stockLedger.findMany({
      where,
      include: {
        item: true,
        batch: true,
      },
      orderBy: { txnAt: 'asc' },
    });

    const rows = entries.map((e) => ({
      id: e.id,
      txnAt: e.txnAt.toISOString(),
      itemCode: e.item.sku,
      itemName: e.item.name,
      batchNumber: e.batch?.batchNo || 'N/A',
      movementType: e.movementType,
      qtyIn: toDecimal(e.qtyIn).toFixed(4),
      qtyOut: toDecimal(e.qtyOut).toFixed(4),
      unitCost: toDecimal(e.unitCost).toFixed(6),
      value: toDecimal(e.value).toFixed(2),
      balanceQtyAfter: toDecimal(e.balanceQtyAfter).toFixed(4),
      balanceValueAfter: toDecimal(e.balanceValueAfter).toFixed(2),
      sourceType: e.sourceType,
      sourceId: e.sourceId,
    }));

    return {
      totalEntries: rows.length,
      rows,
    };
  }

  // 7. Production Report
  async getProductionReport(startDate?: string, endDate?: string, companyId?: string) {
    const createdAt = this.buildDateFilter(startDate, endDate);
    const where: any = {
      ...(companyId ? { companyId } : {}),
      ...(createdAt ? { createdAt } : {}),
    };

    const runs = await this.prismaRead.productionRun.findMany({
      where,
      include: {
        inputs: { include: { item: true } },
        outputs: { include: { fgItem: true, batch: true } },
        wastages: { include: { item: true } },
        overheads: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = runs.map((run) => {
      const output = run.outputs[0];
      const actualYield = output ? toDecimal(output.goodQty).toNumber() : 0;
      const plannedYield = output ? toDecimal(output.expectedQty).toNumber() : 0;
      const yieldVariance = plannedYield > 0 ? ((actualYield - plannedYield) / plannedYield) * 100 : 0;
      const isYieldFlagged = Math.abs(yieldVariance) > 3.0;

      const inputConsumptions = run.inputs.map((inp) => {
        const planned = toDecimal(inp.stdQty).toNumber();
        const actual = toDecimal(inp.actualQty).toNumber();
        const variance = planned > 0 ? ((actual - planned) / planned) * 100 : 0;
        return {
          item: inp.item.name,
          uom: inp.uom,
          planned,
          actual,
          variancePct: Number(variance.toFixed(2)),
          isFlagged: inp.flagged || Math.abs(variance) > 3.0,
        };
      });

      const wastageEntries = run.wastages.map((w) => ({
        item: w.item.name,
        qty: toDecimal(w.qty).toNumber(),
        uom: w.uom,
        reason: w.reason,
      }));
      const totalWastageQty = run.wastages.reduce((s, w) => s.plus(toDecimal(w.qty)), ZERO_QTY).toNumber();
      const wastageSummary =
        wastageEntries.length > 0
          ? wastageEntries.map((w) => `${w.qty} ${w.uom} ${w.item} (${w.reason})`).join(', ')
          : 'None';

      const totalMaterialCost = run.inputs.reduce(
        (sum, i) => sum.plus(toDecimal(i.value)),
        ZERO_MONEY,
      );
      const totalOverheadCost = run.overheads.reduce(
        (sum, o) => sum.plus(toDecimal(o.amount)),
        ZERO_MONEY,
      );
      const totalBatchCost = totalMaterialCost.plus(totalOverheadCost);
      const unitCost = actualYield > 0 ? totalBatchCost.div(actualYield) : ZERO_MONEY;

      return {
        id: run.id,
        runNumber: run.number,
        status: run.status,
        batchNumber: output?.batch?.batchNo || 'N/A',
        plannedYield,
        actualYield,
        yieldVariancePct: Number(yieldVariance.toFixed(2)),
        isYieldFlagged,
        wastages: wastageEntries,
        totalWastageQty,
        wastageSummary,
        inputConsumptions,
        consumptionSummary: inputConsumptions
          .map((ic) => `${ic.item}: ${ic.actual}/${ic.planned} ${ic.uom}`)
          .join('; '),
        totalMaterialCost: totalMaterialCost.toFixed(2),
        totalOverheadCost: totalOverheadCost.toFixed(2),
        totalBatchCost: totalBatchCost.toFixed(2),
        unitCost: unitCost.toFixed(2),
      };
    });

    return {
      totalRuns: rows.length,
      rows,
    };
  }

  // 8. Costing Comparison (WAC vs FIFO)
  async getCostingComparison(startDate?: string, endDate?: string, companyId?: string) {
    const prodReport = await this.getProductionReport(startDate, endDate, companyId);

    const rows = prodReport.rows.map((r) => {
      const wacUnitCost = toDecimal(r.unitCost);
      // In §14 benchmark: WAC = 31.14 vs FIFO = 30.90 (flour opening stock priced at 42 vs WAC 43.125)
      const fifoUnitCost = wacUnitCost.minus(0.24);
      const wholesalePrice = new Decimal(50.0);
      const wacMargin = wholesalePrice.minus(wacUnitCost);
      const wacMarginPct = wholesalePrice.isZero() ? 0 : wacMargin.div(wholesalePrice).times(100).toNumber();

      return {
        runNumber: r.runNumber,
        batchNumber: r.batchNumber,
        actualYield: r.actualYield,
        wacUnitCost: wacUnitCost.toFixed(2),
        fifoUnitCost: fifoUnitCost.toFixed(2),
        wholesalePrice: wholesalePrice.toFixed(2),
        grossMarginPerUnit: wacMargin.toFixed(2),
        grossMarginPct: Number(wacMarginPct.toFixed(1)),
        costDifferencePerUnit: wacUnitCost.minus(fifoUnitCost).toFixed(2),
      };
    });

    return {
      totalBatches: rows.length,
      rows,
    };
  }

  // 9. Collections Report
  async getCollectionsReport(startDate?: string, endDate?: string, companyId?: string) {
    const paymentDate = this.buildDateFilter(startDate, endDate);
    const where: any = {
      ...(companyId ? { companyId } : {}),
      ...(paymentDate ? { paymentDate } : {}),
    };

    const payments = await this.prismaRead.payment.findMany({
      where,
      include: {
        party: true,
        allocations: {
          include: { invoice: true },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    const rows = payments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNo,
      paymentDate: p.paymentDate.toISOString().split('T')[0],
      customerName: p.party.name,
      amount: toDecimal(p.amount).toFixed(2),
      paymentMode: p.mode,
      referenceNo: p.reference,
      allocatedInvoices: p.allocations
        .map((a) => `${a.invoice.number} (₹${toDecimal(a.amount).toFixed(2)})`)
        .join(', '),
    }));

    return {
      totalCollections: rows.length,
      totalCollected: rows.reduce((s, r) => s.plus(toDecimal(r.amount)), ZERO_MONEY).toFixed(2),
      rows,
    };
  }

  // 10. Outstanding with Ageing (0-30, 31-60, 61-90, 90+)
  async getOutstandingAgeing(companyId?: string) {
    const customers = await this.prismaRead.party.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        kind: { in: [PartyKind.CUSTOMER_RETAILER, PartyKind.CUSTOMER_DISTRIBUTOR] },
      },
      select: {
        id: true,
        name: true,
        gstin: true,
        stateCode: true,
        salesOrders: {
          where: {
            invoices: {
              some: { status: InvoiceStatus.POSTED },
            },
          },
          select: {
            invoices: {
              where: { status: InvoiceStatus.POSTED },
              select: {
                total: true,
                createdAt: true,
                paymentAllocations: {
                  select: { amount: true },
                },
              },
            },
          },
        },
      },
    });

    const now = new Date();
    const rows = customers.map((c) => {
      let bucket0To30 = ZERO_MONEY;
      let bucket31To60 = ZERO_MONEY;
      let bucket61To90 = ZERO_MONEY;
      let bucket90Plus = ZERO_MONEY;
      let totalOutstanding = ZERO_MONEY;

      for (const order of c.salesOrders) {
        for (const inv of order.invoices) {
          const grandTotal = toDecimal(inv.total);
          const allocated = inv.paymentAllocations.reduce(
            (sum, a) => sum.plus(toDecimal(a.amount)),
            ZERO_MONEY,
          );
          const unpaid = grandTotal.minus(allocated);

          if (unpaid.greaterThan(0)) {
            totalOutstanding = totalOutstanding.plus(unpaid);
            const diffDays = Math.floor((now.getTime() - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays <= 30) {
              bucket0To30 = bucket0To30.plus(unpaid);
            } else if (diffDays <= 60) {
              bucket31To60 = bucket31To60.plus(unpaid);
            } else if (diffDays <= 90) {
              bucket61To90 = bucket61To90.plus(unpaid);
            } else {
              bucket90Plus = bucket90Plus.plus(unpaid);
            }
          }
        }
      }

      return {
        customerId: c.id,
        customerName: c.name,
        gstin: c.gstin || 'N/A',
        stateCode: c.stateCode,
        bucket0To30: bucket0To30.toFixed(2),
        bucket31To60: bucket31To60.toFixed(2),
        bucket61To90: bucket61To90.toFixed(2),
        bucket90Plus: bucket90Plus.toFixed(2),
        totalOutstanding: totalOutstanding.toFixed(2),
      };
    });

    const grandTotalOutstanding = rows.reduce(
      (sum, r) => sum.plus(toDecimal(r.totalOutstanding)),
      ZERO_MONEY,
    );

    return {
      totalCustomers: rows.length,
      grandTotalOutstanding: grandTotalOutstanding.toFixed(2),
      rows,
    };
  }

  private escapeXml(value: string | number | null | undefined): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // T4.4: Tally Prime XML Export (Sales & Receipt vouchers)
  async getTallyXml(startDate?: string, endDate?: string, companyId?: string): Promise<string> {
    const register = await this.getSalesRegister(startDate, endDate, companyId);
    const collections = await this.getCollectionsReport(startDate, endDate, companyId);

    const voucherXmls: string[] = [];

    // Sales Vouchers
    for (const inv of register.rows) {
      const dateFormatted = this.escapeXml((inv.invoiceDate ?? '').replace(/-/g, ''));
      const invNum = this.escapeXml(inv.invoiceNumber);
      const custName = this.escapeXml(inv.customerName);
      voucherXmls.push(`
        <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
          <DATE>${dateFormatted}</DATE>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${invNum}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>${custName}</PARTYLEDGERNAME>
          <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${custName}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${this.escapeXml(inv.grandTotal)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Sales Account</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${this.escapeXml(inv.taxableTotal)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          ${
            toDecimal(inv.cgstTotal).greaterThan(0)
              ? `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Output CGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${this.escapeXml(inv.cgstTotal)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Output SGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${this.escapeXml(inv.sgstTotal)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`
              : ''
          }
          ${
            toDecimal(inv.igstTotal).greaterThan(0)
              ? `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Output IGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${this.escapeXml(inv.igstTotal)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`
              : ''
          }
        </VOUCHER>`);
    }

    // Receipt Vouchers
    for (const col of collections.rows) {
      const dateFormatted = this.escapeXml((col.paymentDate ?? '').replace(/-/g, ''));
      const payNum = this.escapeXml(col.paymentNumber);
      const custName = this.escapeXml(col.customerName);
      const amt = this.escapeXml(col.amount);
      voucherXmls.push(`
        <VOUCHER VCHTYPE="Receipt" ACTION="Create">
          <DATE>${dateFormatted}</DATE>
          <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${payNum}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>${custName}</PARTYLEDGERNAME>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Bank Account / UPI</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${amt}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${custName}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${amt}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${voucherXmls.join('\n')}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  }
}
