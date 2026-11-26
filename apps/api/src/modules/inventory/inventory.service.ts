import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, MovementType, CostMethod } from '@prisma/client';
import { Decimal, roundMoney, roundQty, roundUnitCost, toDecimal } from '@snackflow/shared';

export class InsufficientStockError extends BadRequestException {
  constructor(public readonly itemId: string, public readonly needed: Decimal, public readonly available: Decimal) {
    super(`Insufficient stock for item '${itemId}': requested ${needed.toString()}, available ${available.toString()}`);
    this.name = 'InsufficientStockError';
  }
}

export interface StockMovementInput {
  companyId: string;
  itemId: string;
  batchId?: string | null | undefined;
  qty: Decimal | number | string; // Positive quantity
  unitCost?: Decimal | number | string | undefined; // Required for IN movements and COST_ADJ
  movementType: MovementType;
  sourceType: string;
  sourceId: string;
  sourceLineId?: string | null | undefined;
  createdBy?: string | null | undefined;
}

@Injectable()
export class InventoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * The single authoritative entry point for writing stock in SnackFlow.
   * Runs within the caller's Prisma transaction client `tx`.
   */
  async postMovements(
    tx: Prisma.TransactionClient,
    movements: StockMovementInput[],
  ) {
    if (!movements || movements.length === 0) {
      return [];
    }

    // 1. Sort movements by (item_id, batch_id) to enforce strict deadlock-free locking order
    const sorted = [...movements].sort((a, b) => {
      const keyA = `${a.itemId}:${a.batchId || ''}`;
      const keyB = `${b.itemId}:${b.batchId || ''}`;
      return keyA.localeCompare(keyB);
    });

    const results: any[] = [];

    // 2. Process each movement inside the transaction with row locks
    for (const mov of sorted) {
      const qty = toDecimal(mov.qty);
      const isOutward =
        mov.movementType === MovementType.ISSUE ||
        mov.movementType === MovementType.DISPATCH ||
        mov.movementType === MovementType.WASTAGE;

      // Fetch item definition and enforce tenant isolation
      const item = await tx.item.findUnique({
        where: { id: mov.itemId },
      });
      if (!item || item.companyId !== mov.companyId) {
        throw new BadRequestException(`Item '${mov.itemId}' not found in catalog`);
      }

      // Acquire transaction-scoped advisory lock on (company, item, batch) to prevent duplicate NULL-batch rows
      const lockKey = `${mov.companyId}:${mov.itemId}:${mov.batchId || ''}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // Lock or initialize the specific stock balance row
      let balance = await tx.stockBalance.findFirst({
        where: {
          companyId: mov.companyId,
          itemId: mov.itemId,
          batchId: mov.batchId || null,
        },
      });

      if (!balance) {
        // Create initial balance row if not exists
        balance = await tx.stockBalance.create({
          data: {
            companyId: mov.companyId,
            itemId: mov.itemId,
            batchId: mov.batchId || null,
            qty: 0,
            value: 0,
            wac: 0,
          },
        });
      }

      // Acquire exclusive row lock
      const lockedRows: any[] = await tx.$queryRaw`
        SELECT id, qty, value, wac
        FROM stock_balance
        WHERE id = ${balance.id}::uuid
        FOR UPDATE
      `;
      const currentBalance = lockedRows[0];
      const curQty = toDecimal(currentBalance.qty);
      const curVal = toDecimal(currentBalance.value);
      const curWac = toDecimal(currentBalance.wac);

      let newQty = new Decimal(0);
      let newVal = new Decimal(0);
      let newWac = curWac;
      let movUnitCost = new Decimal(0);
      let movValue = new Decimal(0);
      let qtyIn = new Decimal(0);
      let qtyOut = new Decimal(0);

      if (mov.movementType === MovementType.COST_ADJ) {
        // Value-only adjustment (e.g. overhead allocation on run close)
        const adjVal = roundMoney(mov.unitCost || 0);
        newQty = curQty;
        newVal = roundMoney(curVal.plus(adjVal));
        newWac = newQty.isZero() ? new Decimal(0) : roundUnitCost(newVal.dividedBy(newQty));
        movUnitCost = newWac;
        movValue = adjVal;
      } else if (!isOutward) {
        // Inward movement (PURCHASE, PRODUCE, OPENING, RETURN, ADJUST+)
        qtyIn = qty;
        const inCost = toDecimal(mov.unitCost || 0);
        movUnitCost = roundUnitCost(inCost);
        movValue = roundMoney(qtyIn.times(movUnitCost));

        newQty = roundQty(curQty.plus(qtyIn));
        newVal = roundMoney(curVal.plus(movValue));

        if (item.costMethod === CostMethod.WAC) {
          newWac = newQty.isZero() ? new Decimal(0) : roundUnitCost(newVal.dividedBy(newQty));
        } else {
          newWac = movUnitCost;
        }
      } else {
        // Outward movement (ISSUE, DISPATCH, WASTAGE)
        qtyOut = qty;

        // Check stock availability
        if (curQty.lessThan(qtyOut)) {
          throw new InsufficientStockError(item.sku, qtyOut, curQty);
        }

        if (item.costMethod === CostMethod.BATCH_ACTUAL && mov.batchId) {
          // Finished goods batch actual cost
          const batch = await tx.stockBatch.findUnique({
            where: { id: mov.batchId },
          });
          movUnitCost = batch ? toDecimal(batch.unitCost) : curWac;
          movValue = roundMoney(qtyOut.times(movUnitCost));
        } else {
          // Raw & packaging moving weighted average cost (WAC)
          movUnitCost = curWac;
          if (qtyOut.equals(curQty)) {
            // Depleting entire stock clears all remaining value to eliminate residual paise
            movValue = curVal;
          } else {
            movValue = roundMoney(qtyOut.times(movUnitCost));
          }
        }

        newQty = roundQty(curQty.minus(qtyOut));
        newVal = roundMoney(curVal.minus(movValue));
        newWac = newQty.isZero() ? new Decimal(0) : curWac;
      }

      // Update stock_balance projection
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: {
          qty: newQty.toNumber(),
          value: newVal.toNumber(),
          wac: newWac.toNumber(),
        },
      });

      // Insert append-only stock_ledger entry
      const ledgerEntry = await tx.stockLedger.create({
        data: {
          companyId: mov.companyId,
          itemId: mov.itemId,
          batchId: mov.batchId || null,
          qtyIn: qtyIn.toNumber(),
          qtyOut: qtyOut.toNumber(),
          unitCost: movUnitCost.toNumber(),
          value: movValue.toNumber(),
          balanceQtyAfter: newQty.toNumber(),
          balanceValueAfter: newVal.toNumber(),
          movementType: mov.movementType,
          sourceType: mov.sourceType,
          sourceId: mov.sourceId,
          sourceLineId: mov.sourceLineId || null,
          createdBy: mov.createdBy || null,
        },
      });

      results.push(ledgerEntry);
    }

    return results;
  }

  /**
   * Reconciliation check: asserts balance == SUM(ledger) for every item & batch in 2 SQL queries (zero N+1)
   */
  async reconcileStock(companyId: string) {
    const [balances, ledgerSums] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where: { companyId },
        include: { item: true, batch: true },
      }),
      this.prisma.$queryRaw<
        Array<{ item_id: string; batch_id: string | null; net_qty: any; net_value: any }>
      >`
        SELECT
          item_id,
          batch_id,
          COALESCE(SUM(qty_in - qty_out), 0) AS net_qty,
          COALESCE(SUM(CASE
            WHEN qty_in > 0 THEN value
            WHEN qty_out > 0 THEN -value
            ELSE value END), 0) AS net_value
        FROM stock_ledger
        WHERE company_id = ${companyId}::uuid
        GROUP BY item_id, batch_id
      `,
    ]);

    const ledgerMap = new Map(
      ledgerSums.map((row) => [`${row.item_id}:${row.batch_id || ''}`, row]),
    );

    const discrepancies: any[] = [];

    for (const bal of balances) {
      const sumRow = ledgerMap.get(`${bal.itemId}:${bal.batchId || ''}`);
      const ledgerNetQty = toDecimal(sumRow?.net_qty || 0);
      const balQty = toDecimal(bal.qty);
      const ledgerNetVal = toDecimal(sumRow?.net_value || 0);
      const balVal = toDecimal(bal.value);

      const qtyMismatch = !ledgerNetQty.equals(balQty);
      const valMismatch = ledgerNetVal.minus(balVal).abs().greaterThan(0.05);

      if (qtyMismatch || valMismatch) {
        discrepancies.push({
          sku: bal.item.sku,
          batchNo: bal.batch?.batchNo || 'NO_BATCH',
          balanceQty: balQty.toString(),
          ledgerQty: ledgerNetQty.toString(),
          diff: balQty.minus(ledgerNetQty).toString(),
          balanceValue: balVal.toFixed(2),
          ledgerValue: ledgerNetVal.toFixed(2),
          valueDiff: balVal.minus(ledgerNetVal).toFixed(2),
        });
      }
    }

    return {
      companyId,
      reconciledAt: new Date().toISOString(),
      discrepancyCount: discrepancies.length,
      isBalanced: discrepancies.length === 0,
      discrepancies,
    };
  }
}
