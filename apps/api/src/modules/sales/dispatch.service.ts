import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import {
  MovementType,
  OrderStatus,
  InvoiceStatus,
  toDecimal,
  getFinancialYear,
  formatInvoiceNumber,
} from '@snackflow/shared';

@Injectable()
export class DispatchService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
  ) {}

  async dispatchInvoice(companyId: string, invoiceId: string, createdBy?: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        lines: { include: { item: true } },
        order: true,
        dispatches: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice '${invoiceId}' not found`);
    }

    if (invoice.status !== InvoiceStatus.POSTED) {
      throw new BadRequestException(
        `Cannot dispatch invoice in status '${invoice.status}'. Only POSTED invoices can be dispatched.`,
      );
    }

    if (invoice.dispatches.length > 0) {
      throw new BadRequestException(`Invoice '${invoice.number}' has already been dispatched.`);
    }

    const fy = getFinancialYear();

    return this.prisma.$transaction(async (tx) => {
      // 1. Sequence allocation for DSP
      const seq = await tx.$queryRaw<Array<{ next_no: number }>>`
        INSERT INTO document_sequence (id, company_id, doc_type, fy, next_no, updated_at)
        VALUES (gen_random_uuid(), ${companyId}::uuid, 'DSP', ${fy}, 2, NOW())
        ON CONFLICT (company_id, doc_type, fy)
        DO UPDATE SET next_no = document_sequence.next_no + 1, updated_at = NOW()
        RETURNING next_no - 1 AS next_no
      `;
      const nextNo = seq[0]?.next_no ?? 1;
      const dispatchNo = formatInvoiceNumber(nextNo, fy, 'DSP');

      // 2. Create Dispatch record
      const dispatch = await tx.dispatch.create({
        data: {
          companyId,
          invoiceId: invoice.id,
          dispatchNo,
          createdBy: createdBy || null,
        },
      });

      const movements: any[] = [];
      const dispatchLinesData: any[] = [];

      // 3. For each invoice line, find batches in strict FEFO order
      for (const line of invoice.lines) {
        let neededQty = toDecimal(line.qty);

        // Fetch balances with positive qty for this item
        const balances = await tx.stockBalance.findMany({
          where: {
            companyId,
            itemId: line.itemId,
            qty: { gt: 0 },
            batchId: { not: null },
          },
          include: {
            batch: true,
          },
        });

        // Filter and sort by expiry_date ASC, mfg_date ASC (Strict FEFO)
        const validBatches = balances
          .filter((b): b is typeof b & { batch: NonNullable<typeof b.batch> } => b.batch !== null)
          .sort((a, b) => {
            const expA = a.batch.expiryDate ? a.batch.expiryDate.getTime() : Number.MAX_SAFE_INTEGER;
            const expB = b.batch.expiryDate ? b.batch.expiryDate.getTime() : Number.MAX_SAFE_INTEGER;
            if (expA !== expB) return expA - expB;
            return a.batch.mfgDate.getTime() - b.batch.mfgDate.getTime();
          });

        const totalAvailable = validBatches.reduce(
          (sum, b) => sum.plus(toDecimal(b.qty)),
          toDecimal(0),
        );

        if (totalAvailable.lessThan(neededQty)) {
          throw new BadRequestException(
            `Insufficient stock to dispatch item '${line.item.name}' (SKU: ${line.item.sku}). Available: ${totalAvailable.toNumber()}, Required: ${neededQty.toNumber()}`,
          );
        }

        // Allocate across batches in FEFO order
        for (const bal of validBatches) {
          if (neededQty.isZero()) break;

          const batchQty = toDecimal(bal.qty);
          const allocQty = batchQty.lessThan(neededQty) ? batchQty : neededQty;

          movements.push({
            companyId,
            itemId: line.itemId,
            batchId: bal.batchId!,
            qty: allocQty,
            movementType: MovementType.DISPATCH,
            sourceType: 'INVOICE',
            sourceId: invoice.id,
            sourceLineId: line.id,
            createdBy: createdBy || null,
          });

          dispatchLinesData.push({
            dispatchId: dispatch.id,
            invoiceLineId: line.id,
            itemId: line.itemId,
            batchId: bal.batchId!,
            qty: allocQty.toNumber(),
          });

          neededQty = neededQty.minus(allocQty);
        }
      }

      // 4. Post stock movements (executes row locks and decrements balances)
      await this.inventoryService.postMovements(tx, movements);

      // 5. Insert dispatch lines
      await tx.dispatchLine.createMany({
        data: dispatchLinesData,
      });

      // 6. Release soft reservations and update order status to DISPATCHED
      if (invoice.orderId) {
        await tx.stockReservation.deleteMany({
          where: {
            orderLine: {
              orderId: invoice.orderId,
            },
          },
        });

        await tx.salesOrder.update({
          where: { id: invoice.orderId },
          data: { status: OrderStatus.DISPATCHED },
        });
      }

      return tx.dispatch.findUnique({
        where: { id: dispatch.id },
        include: {
          lines: {
            include: {
              batch: true,
              invoiceLine: { include: { item: true } },
            },
          },
        },
      });
    });
  }

  async listDispatches(companyId: string) {
    return this.prisma.dispatch.findMany({
      where: { companyId },
      include: {
        invoice: {
          include: {
            order: {
              include: {
                party: true,
              },
            },
          },
        },
        lines: {
          include: {
            batch: true,
            invoiceLine: { include: { item: true } },
          },
        },
      },
      orderBy: { dispatchedAt: 'desc' },
    });
  }
}
