import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import {
  CreatePurchaseDto,
  MovementType,
  toDecimal,
  roundMoney,
  getFinancialYear,
  formatInvoiceNumber,
} from '@snackflow/shared';

@Injectable()
export class PurchasingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
  ) {}

  async createPurchase(companyId: string, dto: CreatePurchaseDto, createdBy?: string) {
    const fy = getFinancialYear();
    return this.prisma.$transaction(async (tx) => {
      const party = await tx.party.findUnique({
        where: { id: dto.partyId },
      });
      if (!party || party.companyId !== companyId) {
        throw new BadRequestException('Supplier party not found');
      }

      const seq = await tx.$queryRaw<Array<{ next_no: number }>>`
        INSERT INTO document_sequence (id, company_id, doc_type, fy, next_no, updated_at)
        VALUES (gen_random_uuid(), ${companyId}::uuid, 'PUR', ${fy}, 2, NOW())
        ON CONFLICT (company_id, doc_type, fy)
        DO UPDATE SET next_no = document_sequence.next_no + 1, updated_at = NOW()
        RETURNING next_no - 1 AS next_no
      `;
      const purchaseNo = formatInvoiceNumber(seq[0]?.next_no ?? 1, fy, 'PUR');
      let totalAmount = toDecimal(0);

      // Calculate total using fixed-precision Decimal arithmetic
      for (const line of dto.lines) {
        const lineTotal = roundMoney(toDecimal(line.qty).times(toDecimal(line.unitCost)));
        totalAmount = totalAmount.plus(lineTotal);
      }
      totalAmount = roundMoney(totalAmount);

      const purchase = await tx.purchase.create({
        data: {
          companyId,
          partyId: dto.partyId,
          purchaseNo,
          supplierInvoiceNo: dto.invoiceNo,
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
          totalAmount: totalAmount.toNumber(),
        },
      });

      const movements = [];

      for (const line of dto.lines) {
        const lineTotal = roundMoney(toDecimal(line.qty).times(toDecimal(line.unitCost)));
        const purchaseLine = await tx.purchaseLine.create({
          data: {
            purchaseId: purchase.id,
            itemId: line.itemId,
            qty: line.qty,
            uom: line.uom,
            unitCost: line.unitCost,
            totalCost: lineTotal.toNumber(),
          },
        });

        movements.push({
          companyId,
          itemId: line.itemId,
          qty: line.qty,
          unitCost: line.unitCost,
          movementType: MovementType.PURCHASE,
          sourceType: 'PURCHASE',
          sourceId: purchase.id,
          sourceLineId: purchaseLine.id,
          createdBy,
        });
      }

      // Post movements to ledger and update WAC in same transaction
      await this.inventoryService.postMovements(tx, movements);

      return tx.purchase.findUnique({
        where: { id: purchase.id },
        include: { lines: { include: { item: true } }, party: true },
      });
    });
  }

  async listPurchases(companyId: string, limit?: number, offset?: number) {
    const take = Math.min(Math.max(1, Number(limit) || 200), 500);
    const skip = Math.max(0, Number(offset) || 0);
    return this.prisma.purchase.findMany({
      where: { companyId },
      include: { lines: { include: { item: true } }, party: true },
      orderBy: { purchaseDate: 'desc' },
      take,
      skip,
    });
  }
}
