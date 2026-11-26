import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import {
  CreateCreditNoteDto,
  InvoiceStatus,
  OrderStatus,
  MovementType,
  getFinancialYear,
  formatInvoiceNumber,
  toDecimal,
} from '@snackflow/shared';

@Injectable()
export class CreditNoteService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
  ) {}

  async createCreditNote(
    companyId: string,
    invoiceId: string,
    dto: CreateCreditNoteDto,
    createdBy?: string,
  ) {
    const fy = getFinancialYear();

    return this.prisma.$transaction(async (tx) => {
      // Lock invoice row inside transaction so concurrent credit-note calls cannot double-restore stock
      const lockedInv = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM invoice WHERE id = ${invoiceId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE
      `;
      if (lockedInv.length === 0) {
        throw new NotFoundException(`Invoice '${invoiceId}' not found`);
      }

      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, companyId },
        include: {
          lines: true,
          dispatches: {
            include: {
              lines: true,
            },
          },
          creditNotes: true,
        },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice '${invoiceId}' not found`);
      }

      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException(`Invoice '${invoice.number}' has already been cancelled.`);
      }

      // 1. Sequence allocation for CN
      const seq = await tx.$queryRaw<Array<{ next_no: number }>>`
        INSERT INTO document_sequence (id, company_id, doc_type, fy, next_no, updated_at)
        VALUES (gen_random_uuid(), ${companyId}::uuid, 'CN', ${fy}, 2, NOW())
        ON CONFLICT (company_id, doc_type, fy)
        DO UPDATE SET next_no = document_sequence.next_no + 1, updated_at = NOW()
        RETURNING next_no - 1 AS next_no
      `;
      const nextNo = seq[0]?.next_no ?? 1;
      const creditNoteNo = formatInvoiceNumber(nextNo, fy, 'CN');

      const taxAmount = toDecimal(invoice.cgst)
        .plus(toDecimal(invoice.sgst))
        .plus(toDecimal(invoice.igst));

      // 2. Create Credit Note record
      const creditNote = await tx.creditNote.create({
        data: {
          companyId,
          invoiceId: invoice.id,
          creditNoteNo,
          reason: dto.reason,
          amount: invoice.taxable,
          taxAmount: taxAmount.toNumber(),
          total: invoice.total,
        },
      });

      // 3. Return stock to inventory if invoice had been dispatched
      const movements: any[] = [];
      for (const dispatch of invoice.dispatches) {
        for (const dLine of dispatch.lines) {
          movements.push({
            companyId,
            itemId: dLine.itemId,
            batchId: dLine.batchId,
            qty: toDecimal(dLine.qty),
            movementType: MovementType.RETURN,
            sourceType: 'CREDIT_NOTE',
            sourceId: creditNote.id,
            sourceLineId: dLine.id,
            createdBy: createdBy || null,
          });
        }
      }

      if (movements.length > 0) {
        await this.inventoryService.postMovements(tx, movements);
      }

      // 4. Mark invoice as CANCELLED
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.CANCELLED },
      });

      // 5. Mark associated order as CANCELLED
      if (invoice.orderId) {
        await tx.salesOrder.update({
          where: { id: invoice.orderId },
          data: { status: OrderStatus.CANCELLED },
        });
      }

      return creditNote;
    });
  }

  async listCreditNotes(companyId: string) {
    return this.prisma.creditNote.findMany({
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
