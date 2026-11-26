import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ApproveOrderDto,
  OrderStatus,
  toDecimal,
  roundMoney,
  computeLineGst,
  getFinancialYear,
  formatInvoiceNumber,
} from '@snackflow/shared';

@Injectable()
export class ApprovalService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async approveOrder(companyId: string, orderId: string, dto: ApproveOrderDto) {
    const fy = getFinancialYear();

    return this.prisma.$transaction(async (tx) => {
      // Lock the sales order row inside transaction so concurrent approvals serialize cleanly
      const lockedOrder = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM sales_order WHERE id = ${orderId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE
      `;
      if (lockedOrder.length === 0) {
        throw new NotFoundException(`Order '${orderId}' not found`);
      }

      const order = await tx.salesOrder.findFirst({
        where: { id: orderId, companyId },
        include: {
          lines: { include: { item: true, reservations: true } },
          party: true,
          company: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Order '${orderId}' not found`);
      }

      if (order.status !== OrderStatus.SUBMITTED && order.status !== OrderStatus.ON_HOLD) {
        throw new BadRequestException(
          `Cannot approve order in status '${order.status}'. Only SUBMITTED or ON_HOLD orders can be approved.`,
        );
      }

      if (dto.action === 'HOLD') {
        return tx.salesOrder.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.ON_HOLD,
            notes: dto.notes || order.notes,
          },
          include: { lines: true, party: true },
        });
      }

      if (dto.action === 'REJECT') {
        await tx.stockReservation.deleteMany({
          where: {
            orderLineId: { in: order.lines.map((l) => l.id) },
          },
        });

        return tx.salesOrder.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.REJECTED,
            notes: dto.notes || order.notes,
          },
          include: { lines: true, party: true },
        });
      }

      // Acquire deterministic sorted per-item advisory locks to prevent concurrent over-approval
      const sortedItemIds = Array.from(new Set(order.lines.map((l) => l.itemId))).sort();
      for (const itemId of sortedItemIds) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${companyId}:${itemId}:approval`}))`;
      }

      if (dto.action === 'APPROVE_FULL') {
        for (const line of order.lines) {
          const bal = await tx.stockBalance.aggregate({
            where: { itemId: line.itemId, companyId },
            _sum: { qty: true },
          });
          const totalOnHand = toDecimal(bal._sum.qty || 0);

          const otherRes = await tx.stockReservation.aggregate({
            where: {
              itemId: line.itemId,
              companyId,
              orderLineId: { not: line.id },
            },
            _sum: { qty: true },
          });
          const reservedOther = toDecimal(otherRes._sum.qty || 0);
          const available = totalOnHand.minus(reservedOther);

          if (available.lessThan(toDecimal(line.qty))) {
            throw new BadRequestException(
              `Insufficient stock for item '${line.item.name}' (SKU: ${line.item.sku}). Available: ${available.toNumber()}, Required: ${line.qty.toNumber()}`,
            );
          }
        }

        return tx.salesOrder.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.APPROVED,
            notes: dto.notes || order.notes,
          },
          include: { lines: true, party: true },
        });
      }

      if (dto.action === 'APPROVE_AVAILABLE_BACKORDER') {
        const isInterState = order.party.stateCode !== order.company.stateCode;
        let hasShortage = false;
        let totalApprovedQty = toDecimal(0);
        const backorderLines: Array<{
          itemId: string;
          qty: number;
          uom: string;
          rate: number;
          taxable: number;
          gstRate: number;
          cgst: number;
          sgst: number;
          igst: number;
          total: number;
        }> = [];

        let updatedTaxableTotal = toDecimal(0);
        let updatedTaxTotal = toDecimal(0);
        let updatedGrandTotal = toDecimal(0);

        const suggestedBatches: Array<{
          itemId: string;
          itemSku: string;
          shortageQty: number;
          suggestedBatchCount: number;
        }> = [];

        for (const line of order.lines) {
          const bal = await tx.stockBalance.aggregate({
            where: { itemId: line.itemId, companyId },
            _sum: { qty: true },
          });
          const totalOnHand = toDecimal(bal._sum.qty || 0);

          const otherRes = await tx.stockReservation.aggregate({
            where: {
              itemId: line.itemId,
              companyId,
              orderLineId: { not: line.id },
            },
            _sum: { qty: true },
          });
          const reservedOther = toDecimal(otherRes._sum.qty || 0);
          const available = totalOnHand.minus(reservedOther);
          const orderedQty = toDecimal(line.qty);

          if (available.lessThan(orderedQty)) {
            hasShortage = true;
            const approvedQty = available.greaterThan(0) ? available : toDecimal(0);
            totalApprovedQty = totalApprovedQty.plus(approvedQty);
            const shortageQty = orderedQty.minus(approvedQty);

            const approvedGst = computeLineGst({
              rate: line.rate.toNumber(),
              qty: approvedQty.toNumber(),
              gstRate: line.gstRate.toNumber(),
              isInterState,
            });

            await tx.salesOrderLine.update({
              where: { id: line.id },
              data: {
                qty: approvedQty.toNumber(),
                taxable: approvedGst.taxable,
                cgst: approvedGst.cgst,
                sgst: approvedGst.sgst,
                igst: approvedGst.igst,
                total: approvedGst.total,
              },
            });

            await tx.stockReservation.updateMany({
              where: { orderLineId: line.id },
              data: { qty: approvedQty.toNumber() },
            });

            updatedTaxableTotal = updatedTaxableTotal.plus(approvedGst.taxable);
            updatedTaxTotal = updatedTaxTotal.plus(approvedGst.totalTax);
            updatedGrandTotal = updatedGrandTotal.plus(approvedGst.total);

            const boGst = computeLineGst({
              rate: line.rate.toNumber(),
              qty: shortageQty.toNumber(),
              gstRate: line.gstRate.toNumber(),
              isInterState,
            });

            backorderLines.push({
              itemId: line.itemId,
              qty: shortageQty.toNumber(),
              uom: line.uom,
              rate: line.rate.toNumber(),
              taxable: boGst.taxable,
              gstRate: line.gstRate.toNumber(),
              cgst: boGst.cgst,
              sgst: boGst.sgst,
              igst: boGst.igst,
              total: boGst.total,
            });

            const weightG = line.item?.netWeightG ? Number(line.item.netWeightG) : 200;
            const packetsPerBatch = weightG > 0 ? Math.max(1, Math.round(40000 / weightG)) : 200;
            const suggestedCount = Math.ceil(shortageQty.toNumber() / packetsPerBatch);
            suggestedBatches.push({
              itemId: line.itemId,
              itemSku: line.item.sku,
              shortageQty: shortageQty.toNumber(),
              suggestedBatchCount: suggestedCount,
            });
          } else {
            totalApprovedQty = totalApprovedQty.plus(orderedQty);
            updatedTaxableTotal = updatedTaxableTotal.plus(line.taxable);
            updatedTaxTotal = updatedTaxTotal.plus(line.cgst).plus(line.sgst).plus(line.igst);
            updatedGrandTotal = updatedGrandTotal.plus(line.total);
          }
        }

        if (totalApprovedQty.lessThanOrEqualTo(0)) {
          throw new BadRequestException(
            'No stock is currently available to fulfill any line on this order.',
          );
        }

        const approvedOrder = await tx.salesOrder.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.APPROVED,
            taxableTotal: roundMoney(updatedTaxableTotal).toNumber(),
            taxTotal: roundMoney(updatedTaxTotal).toNumber(),
            grandTotal: roundMoney(updatedGrandTotal).toNumber(),
            notes: dto.notes || order.notes,
          },
          include: { lines: true, party: true },
        });

        let backorderOrder = null;
        if (hasShortage && backorderLines.length > 0) {
          const boSeq = await tx.$queryRaw<Array<{ next_no: number }>>`
            INSERT INTO document_sequence (id, company_id, doc_type, fy, next_no, updated_at)
            VALUES (gen_random_uuid(), ${companyId}::uuid, 'ORD', ${fy}, 2, NOW())
            ON CONFLICT (company_id, doc_type, fy)
            DO UPDATE SET next_no = document_sequence.next_no + 1, updated_at = NOW()
            RETURNING next_no - 1 AS next_no
          `;
          const boNextNo = boSeq[0]?.next_no ?? 1;
          const boNumber = formatInvoiceNumber(boNextNo, fy, 'ORD');

          let boTaxable = toDecimal(0);
          let boTax = toDecimal(0);
          let boGrand = toDecimal(0);
          for (const bl of backorderLines) {
            boTaxable = boTaxable.plus(bl.taxable);
            boTax = boTax.plus(bl.cgst).plus(bl.sgst).plus(bl.igst);
            boGrand = boGrand.plus(bl.total);
          }

          backorderOrder = await tx.salesOrder.create({
            data: {
              companyId,
              number: boNumber,
              partyId: order.partyId,
              salesmanId: order.salesmanId,
              status: OrderStatus.SUBMITTED,
              clientUuid: `${order.clientUuid}-BO-${Date.now()}`,
              taxableTotal: roundMoney(boTaxable).toNumber(),
              taxTotal: roundMoney(boTax).toNumber(),
              grandTotal: roundMoney(boGrand).toNumber(),
              notes: `Backorder for shortage from ${order.number}`,
              lines: {
                create: backorderLines,
              },
            },
            include: { lines: true },
          });
        }

        return {
          order: approvedOrder,
          backorder: backorderOrder,
          suggestedProductionBatches: suggestedBatches,
        };
      }

      throw new BadRequestException(`Unknown action '${(dto as any).action}'`);
    });
  }
}
