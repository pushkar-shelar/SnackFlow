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
    const order = await this.prisma.salesOrder.findFirst({
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
      return this.prisma.salesOrder.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.ON_HOLD,
          notes: dto.notes || order.notes,
        },
        include: { lines: true, party: true },
      });
    }

    if (dto.action === 'REJECT') {
      return this.prisma.$transaction(async (tx) => {
        // Release reservations
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
      });
    }

    if (dto.action === 'APPROVE_FULL') {
      // Verify available stock for each line
      for (const line of order.lines) {
        const bal = await this.prisma.stockBalance.aggregate({
          where: { itemId: line.itemId, companyId },
          _sum: { qty: true },
        });
        const totalOnHand = toDecimal(bal._sum.qty || 0);

        // Reservations by other orders
        const otherRes = await this.prisma.stockReservation.aggregate({
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

      return this.prisma.salesOrder.update({
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
      const fy = getFinancialYear();

      return this.prisma.$transaction(async (tx) => {
        let hasShortage = false;
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
            const shortageQty = orderedQty.minus(approvedQty);

            // Recompute original line for approvedQty
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

            // Update reservation on this line to approvedQty
            await tx.stockReservation.updateMany({
              where: { orderLineId: line.id },
              data: { qty: approvedQty.toNumber() },
            });

            updatedTaxableTotal = updatedTaxableTotal.plus(approvedGst.taxable);
            updatedTaxTotal = updatedTaxTotal.plus(approvedGst.totalTax);
            updatedGrandTotal = updatedGrandTotal.plus(approvedGst.total);

            // Backorder line for shortage
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

            // Calculate suggested production batch
            // Standard batch is 200 packets for Murukku
            const suggestedCount = Math.ceil(shortageQty.toNumber() / 200);
            suggestedBatches.push({
              itemId: line.itemId,
              itemSku: line.item.sku,
              shortageQty: shortageQty.toNumber(),
              suggestedBatchCount: suggestedCount,
            });
          } else {
            // Full qty available for this line
            updatedTaxableTotal = updatedTaxableTotal.plus(line.taxable);
            updatedTaxTotal = updatedTaxTotal.plus(line.cgst).plus(line.sgst).plus(line.igst);
            updatedGrandTotal = updatedGrandTotal.plus(line.total);
          }
        }

        // Update original order totals and status
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

        // Create backorder order if there was a shortage
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
      });
    }

    throw new BadRequestException(`Unknown action '${(dto as any).action}'`);
  }
}
