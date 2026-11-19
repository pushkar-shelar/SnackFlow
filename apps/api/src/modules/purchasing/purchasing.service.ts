import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { CreatePurchaseDto, MovementType } from '@snackflow/shared';

@Injectable()
export class PurchasingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
  ) {}

  async createPurchase(companyId: string, dto: CreatePurchaseDto, createdBy?: string) {
    return this.prisma.$transaction(async (tx) => {
      const party = await tx.party.findUnique({
        where: { id: dto.partyId },
      });
      if (!party || party.companyId !== companyId) {
        throw new BadRequestException('Supplier party not found');
      }

      const purchaseNo = `PUR-${Date.now().toString().slice(-6)}`;
      let totalAmount = 0;

      // Calculate total
      for (const line of dto.lines) {
        totalAmount += line.qty * line.unitCost;
      }

      const purchase = await tx.purchase.create({
        data: {
          companyId,
          partyId: dto.partyId,
          purchaseNo,
          supplierInvoiceNo: dto.invoiceNo,
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
          totalAmount,
        },
      });

      const movements = [];

      for (const line of dto.lines) {
        const lineTotal = line.qty * line.unitCost;
        const purchaseLine = await tx.purchaseLine.create({
          data: {
            purchaseId: purchase.id,
            itemId: line.itemId,
            qty: line.qty,
            uom: line.uom,
            unitCost: line.unitCost,
            totalCost: lineTotal,
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

  async listPurchases(companyId: string) {
    return this.prisma.purchase.findMany({
      where: { companyId },
      include: { lines: { include: { item: true } }, party: true },
      orderBy: { purchaseDate: 'desc' },
    });
  }
}
