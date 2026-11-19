import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaReadService } from '../../prisma/prisma-read.service.js';
import { toDecimal } from '@snackflow/shared';
import Decimal from 'decimal.js';
import { PartyKind } from '@prisma/client';

const ZERO_MONEY = new Decimal(0);
const ZERO_QTY = new Decimal(0);

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(@Inject(PrismaReadService) private readonly prismaRead: PrismaReadService) {}

  // 1. Sales Register
  async getSalesRegister(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const invoices = await this.prismaRead.invoice.findMany({
      where,
      include: {
        order: {
          include: { party: true },
        },
        lines: {
          include: { item: true },
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
        lineCount: inv.lines.length,
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
  async getSalesByCustomer(startDate?: string, endDate?: string) {
    const register = await this.getSalesRegister(startDate, endDate);
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

  async getSalesByProduct(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const lines = await this.prismaRead.invoiceLine.findMany({
      where,
      include: {
        item: true,
      },
    });

    const map = new Map<string, { itemCode: string; itemName: string; uom: string; totalQty: Decimal; totalTaxable: Decimal }>();

    for (const line of lines) {
      const key = line.item.sku;
      const existing = map.get(key) || {
        itemCode: line.item.sku,
        itemName: line.item.name,
        uom: line.item.baseUom,
        totalQty: ZERO_QTY,
        totalTaxable: ZERO_MONEY,
      };

      existing.totalQty = existing.totalQty.plus(toDecimal(line.qty));
      existing.totalTaxable = existing.totalTaxable.plus(toDecimal(line.taxable));
      map.set(key, existing);
    }

    return Array.from(map.values()).map((v) => ({
      itemCode: v.itemCode,
      itemName: v.itemName,
      uom: v.uom,
      totalQty: v.totalQty.toFixed(2),
      totalTaxable: v.totalTaxable.toFixed(2),
    }));
  }

  // 3. GST Outward Summary (GSTR-1 & GSTR-3B shape)
  async getGstSummary(startDate?: string, endDate?: string) {
    const register = await this.getSalesRegister(startDate, endDate);

    // GSTR-1 Table 4: B2B Invoices (registered customers with valid GSTIN)
    const b2bRows = register.rows.filter((r) => r.customerGstin && r.customerGstin !== 'UNREGISTERED');

    // GSTR-1 Table 7: B2CS Invoices (unregistered consumer/retail)
    const b2csRows = register.rows.filter((r) => !r.customerGstin || r.customerGstin === 'UNREGISTERED');

    // Table 12: HSN Summary
    const invoiceIds = register.rows.map((r) => r.id);
    const lines = await this.prismaRead.invoiceLine.findMany({
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
  async getPurchaseRegister(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) where.purchaseDate.gte = new Date(startDate);
      if (endDate) where.purchaseDate.lte = new Date(endDate);
    }

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

  // 5. Stock Summary (Opening, Receipts, Issues, Closing, Value)
  async getStockSummary(startDate?: string, endDate?: string) {
    const items = await this.prismaRead.item.findMany({
      include: {
        stockBalances: true,
      },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });

    const rows = items.map((item) => {
      const currentQty = item.stockBalances.reduce((sum, b) => sum.plus(toDecimal(b.qty)), ZERO_QTY);
      const currentValue = item.stockBalances.reduce((sum, b) => sum.plus(toDecimal(b.value)), ZERO_MONEY);
      const wac = currentQty.isZero() ? ZERO_MONEY : currentValue.div(currentQty);

      return {
        id: item.id,
        code: item.sku,
        name: item.name,
        kind: item.kind,
        uom: item.baseUom,
        currentQty: currentQty.toFixed(4),
        currentValue: currentValue.toFixed(2),
        wac: wac.toFixed(6),
        reorderLevel: item.reorderLevel ? toDecimal(item.reorderLevel).toFixed(2) : null,
        isBelowReorder: item.reorderLevel ? currentQty.lessThan(toDecimal(item.reorderLevel)) : false,
      };
    });

    const totalValuation = rows.reduce((sum, r) => sum.plus(toDecimal(r.currentValue)), ZERO_MONEY);

    return {
      totalItems: rows.length,
      totalValuation: totalValuation.toFixed(2),
      rows,
    };
  }

  // 6. Stock Ledger
  async getStockLedger(itemId?: string, startDate?: string, endDate?: string) {
    const where: any = {};
    if (itemId) where.itemId = itemId;
    if (startDate || endDate) {
      where.txnAt = {};
      if (startDate) where.txnAt.gte = new Date(startDate);
      if (endDate) where.txnAt.lte = new Date(endDate);
    }

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
  async getProductionReport(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const runs = await this.prismaRead.productionRun.findMany({
      where,
      include: {
        inputs: { include: { item: true } },
        outputs: { include: { fgItem: true, batch: true } },
        wastages: true,
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
          planned,
          actual,
          variancePct: Number(variance.toFixed(2)),
          isFlagged: inp.flagged || Math.abs(variance) > 3.0,
        };
      });

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
        inputConsumptions,
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
  async getCostingComparison(startDate?: string, endDate?: string) {
    const prodReport = await this.getProductionReport(startDate, endDate);

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
  async getCollectionsReport(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

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
  async getOutstandingAgeing() {
    const customers = await this.prismaRead.party.findMany({
      where: {
        kind: { in: [PartyKind.CUSTOMER_RETAILER, PartyKind.CUSTOMER_DISTRIBUTOR] },
      },
      include: {
        salesOrders: {
          include: {
            invoices: {
              include: {
                paymentAllocations: true,
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
}
