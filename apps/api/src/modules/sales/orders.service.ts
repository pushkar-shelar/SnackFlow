import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CreateOrderDto,
  computeLineGst,
  toDecimal,
  roundMoney,
  getFinancialYear,
  formatInvoiceNumber,
  OrderStatus,
} from '@snackflow/shared';

@Injectable()
export class OrdersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createOrder(companyId: string, salesmanId: string, dto: CreateOrderDto) {
    // 1. Idempotency Check: if clientUuid exists, return the existing order
    const existing = await this.prisma.salesOrder.findUnique({
      where: { clientUuid: dto.clientUuid },
      include: {
        party: true,
        lines: { include: { item: true } },
      },
    });

    if (existing) {
      return existing;
    }

    // 2. Load Company and Party
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company not found`);
    }

    const party = await this.prisma.party.findFirst({
      where: { id: dto.partyId, companyId },
    });
    if (!party) {
      throw new NotFoundException(`Party '${dto.partyId}' not found`);
    }

    const isInterState = party.stateCode !== company.stateCode;

    // 3. Pre-fetch items and compute line taxes
    const itemIds = dto.lines.map((l) => l.itemId);
    const items = await this.prisma.item.findMany({
      where: { id: { in: itemIds }, companyId },
    });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    let taxableTotal = toDecimal(0);
    let taxTotal = toDecimal(0);
    let grandTotal = toDecimal(0);

    const calculatedLines = dto.lines.map((line) => {
      const item = itemMap.get(line.itemId);
      if (!item) {
        throw new BadRequestException(`Item '${line.itemId}' not found in company catalog`);
      }

      const gstBreakdown = computeLineGst({
        rate: line.rate,
        qty: line.qty,
        gstRate: item.gstRate.toNumber(),
        isInterState,
      });

      taxableTotal = taxableTotal.plus(gstBreakdown.taxable);
      taxTotal = taxTotal.plus(gstBreakdown.totalTax);
      grandTotal = grandTotal.plus(gstBreakdown.total);

      return {
        itemId: line.itemId,
        qty: toDecimal(line.qty),
        uom: line.uom,
        rate: toDecimal(line.rate),
        taxable: toDecimal(gstBreakdown.taxable),
        gstRate: toDecimal(item.gstRate),
        cgst: toDecimal(gstBreakdown.cgst),
        sgst: toDecimal(gstBreakdown.sgst),
        igst: toDecimal(gstBreakdown.igst),
        total: toDecimal(gstBreakdown.total),
      };
    });

    taxableTotal = roundMoney(taxableTotal);
    taxTotal = roundMoney(taxTotal);
    grandTotal = roundMoney(grandTotal);

    const fy = getFinancialYear();

    return this.prisma.$transaction(async (tx) => {
      // Sequence allocation under row lock
      const seq = await tx.$queryRaw<Array<{ next_no: number }>>`
        INSERT INTO document_sequence (id, company_id, doc_type, fy, next_no, updated_at)
        VALUES (gen_random_uuid(), ${companyId}::uuid, 'ORD', ${fy}, 2, NOW())
        ON CONFLICT (company_id, doc_type, fy)
        DO UPDATE SET next_no = document_sequence.next_no + 1, updated_at = NOW()
        RETURNING next_no - 1 AS next_no
      `;
      const nextNo = seq[0]?.next_no ?? 1;
      const orderNumber = formatInvoiceNumber(nextNo, fy, 'ORD');

      // Create Sales Order
      const order = await tx.salesOrder.create({
        data: {
          companyId,
          number: orderNumber,
          partyId: dto.partyId,
          salesmanId: dto.salesmanId || salesmanId,
          status: OrderStatus.SUBMITTED,
          clientUuid: dto.clientUuid,
          geoLat: dto.geoLat !== undefined ? toDecimal(dto.geoLat).toNumber() : null,
          geoLng: dto.geoLng !== undefined ? toDecimal(dto.geoLng).toNumber() : null,
          taxableTotal: taxableTotal.toNumber(),
          taxTotal: taxTotal.toNumber(),
          grandTotal: grandTotal.toNumber(),
          lines: {
            create: calculatedLines.map((l) => ({
              itemId: l.itemId,
              qty: l.qty.toNumber(),
              uom: l.uom,
              rate: l.rate.toNumber(),
              taxable: l.taxable.toNumber(),
              gstRate: l.gstRate.toNumber(),
              cgst: l.cgst.toNumber(),
              sgst: l.sgst.toNumber(),
              igst: l.igst.toNumber(),
              total: l.total.toNumber(),
            })),
          },
        },
        include: {
          lines: true,
          party: true,
        },
      });

      // Soft reservation creation for each line
      for (const line of order.lines) {
        await tx.stockReservation.create({
          data: {
            companyId,
            orderLineId: line.id,
            itemId: line.itemId,
            qty: line.qty,
          },
        });
      }

      return order;
    });
  }

  async listOrders(
    companyId: string,
    filters?: { salesmanId?: string; status?: OrderStatus; partyId?: string },
  ) {
    return this.prisma.salesOrder.findMany({
      where: {
        companyId,
        ...(filters?.salesmanId ? { salesmanId: filters.salesmanId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.partyId ? { partyId: filters.partyId } : {}),
      },
      include: {
        party: true,
        salesman: { select: { id: true, name: true, email: true } },
        lines: { include: { item: true } },
        invoices: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrder(companyId: string, orderId: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: orderId, companyId },
      include: {
        party: true,
        salesman: { select: { id: true, name: true, email: true } },
        lines: {
          include: {
            item: true,
            reservations: true,
          },
        },
        invoices: {
          include: {
            lines: true,
            dispatches: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    return order;
  }
}
