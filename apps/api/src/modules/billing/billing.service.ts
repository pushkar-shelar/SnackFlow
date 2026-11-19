import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  PostInvoiceDto,
  SupplyType,
  InvoiceStatus,
  OrderStatus,
  toDecimal,
  roundMoney,
  computeLineGst,
  getFinancialYear,
  formatInvoiceNumber,
} from '@snackflow/shared';

@Injectable()
export class BillingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async postInvoice(companyId: string, dto: PostInvoiceDto, _createdBy?: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: dto.orderId, companyId },
      include: {
        lines: { include: { item: true } },
        party: true,
        company: true,
        invoices: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Sales order '${dto.orderId}' not found`);
    }

    if (order.status !== OrderStatus.APPROVED && order.status !== OrderStatus.PARTIALLY_APPROVED) {
      throw new BadRequestException(
        `Cannot invoice order in status '${order.status}'. Order must be APPROVED before invoicing.`,
      );
    }

    if (order.invoices.some((inv) => inv.status === InvoiceStatus.POSTED)) {
      throw new BadRequestException(`Order '${order.number}' has already been invoiced.`);
    }

    const isInterState = order.party.stateCode !== order.company.stateCode;
    const supplyType = isInterState ? SupplyType.INTER : SupplyType.INTRA;
    const fy = getFinancialYear();

    let taxableTotal = toDecimal(0);
    let cgstTotal = toDecimal(0);
    let sgstTotal = toDecimal(0);
    let igstTotal = toDecimal(0);
    let grandTotal = toDecimal(0);

    const invoiceLinesData = order.lines.map((line) => {
      const gst = computeLineGst({
        rate: line.rate.toNumber(),
        qty: line.qty.toNumber(),
        gstRate: line.gstRate.toNumber(),
        isInterState,
      });

      taxableTotal = taxableTotal.plus(gst.taxable);
      cgstTotal = cgstTotal.plus(gst.cgst);
      sgstTotal = sgstTotal.plus(gst.sgst);
      igstTotal = igstTotal.plus(gst.igst);
      grandTotal = grandTotal.plus(gst.total);

      return {
        itemId: line.itemId,
        hsn: line.item.hsn,
        qty: line.qty.toNumber(),
        uom: line.uom,
        rate: line.rate.toNumber(),
        taxable: gst.taxable,
        gstRate: line.gstRate.toNumber(),
        cgst: gst.cgst,
        sgst: gst.sgst,
        igst: gst.igst,
        total: gst.total,
      };
    });

    taxableTotal = roundMoney(taxableTotal);
    cgstTotal = roundMoney(cgstTotal);
    sgstTotal = roundMoney(sgstTotal);
    igstTotal = roundMoney(igstTotal);
    grandTotal = roundMoney(grandTotal);

    return this.prisma.$transaction(async (tx) => {
      // 1. Allocate sequence under row lock
      const seq = await tx.$queryRaw<Array<{ next_no: number }>>`
        INSERT INTO document_sequence (id, company_id, doc_type, fy, next_no, updated_at)
        VALUES (gen_random_uuid(), ${companyId}::uuid, 'INV', ${fy}, 2, NOW())
        ON CONFLICT (company_id, doc_type, fy)
        DO UPDATE SET next_no = document_sequence.next_no + 1, updated_at = NOW()
        RETURNING next_no - 1 AS next_no
      `;
      const nextNo = seq[0]?.next_no ?? 1;
      const invoiceNumber = formatInvoiceNumber(nextNo, fy, 'INV');

      // 2. Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          companyId,
          orderId: order.id,
          number: invoiceNumber,
          fy,
          placeOfSupply: order.party.stateCode,
          supplyType,
          taxable: taxableTotal.toNumber(),
          cgst: cgstTotal.toNumber(),
          sgst: sgstTotal.toNumber(),
          igst: igstTotal.toNumber(),
          roundOff: 0,
          total: grandTotal.toNumber(),
          status: InvoiceStatus.POSTED,
          signedQr: `MOCK_QR_${invoiceNumber}_${Date.now()}`,
          lines: {
            create: invoiceLinesData,
          },
        },
        include: {
          lines: { include: { item: true } },
          order: { include: { party: true } },
        },
      });

      // 3. Update order status to INVOICED
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: OrderStatus.INVOICED },
      });

      return invoice;
    });
  }

  async getInvoice(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: {
        lines: { include: { item: true } },
        order: {
          include: {
            party: true,
            salesman: { select: { id: true, name: true, email: true } },
          },
        },
        dispatches: {
          include: {
            lines: {
              include: {
                batch: true,
                invoiceLine: { include: { item: true } },
              },
            },
          },
        },
        creditNotes: true,
        paymentAllocations: {
          include: {
            payment: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice '${id}' not found`);
    }

    return invoice;
  }

  async listInvoices(
    companyId: string,
    filters?: { partyId?: string; status?: InvoiceStatus },
  ) {
    return this.prisma.invoice.findMany({
      where: {
        companyId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.partyId
          ? {
              order: {
                partyId: filters.partyId,
              },
            }
          : {}),
      },
      include: {
        lines: { include: { item: true } },
        order: { include: { party: true } },
        dispatches: true,
        creditNotes: true,
        paymentAllocations: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
