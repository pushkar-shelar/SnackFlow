import {
  Injectable,
  BadRequestException,
  ForbiddenException,
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
  Role,
} from '@snackflow/shared';

@Injectable()
export class OrdersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createOrder(
    companyId: string,
    callerUserId: string,
    callerRole: Role,
    dto: CreateOrderDto,
  ) {
    // 1. Idempotency Check: if clientUuid exists, return the existing order
    const existing = await this.prisma.salesOrder.findUnique({
      where: { clientUuid: dto.clientUuid },
      include: {
        party: true,
        lines: { include: { item: true } },
      },
    });

    if (existing) {
      if (existing.companyId !== companyId) {
        throw new ForbiddenException('Access denied for duplicate clientUuid');
      }
      return existing;
    }

    // Enforce salesman ownership: SALESMAN cannot attribute orders to another user
    const resolvedSalesmanId =
      callerRole === Role.SALESMAN ? callerUserId : dto.salesmanId || callerUserId;

    if (resolvedSalesmanId !== callerUserId) {
      const assignedUser = await this.prisma.user.findFirst({
        where: { id: resolvedSalesmanId, companyId, isActive: true },
      });
      if (!assignedUser) {
        throw new BadRequestException(`Invalid salesmanId '${resolvedSalesmanId}'`);
      }
    }

    // 2. Load Company and Party (including priceList rates)
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company not found`);
    }

    const party = await this.prisma.party.findFirst({
      where: { id: dto.partyId, companyId },
      include: {
        priceList: { include: { items: true } },
      },
    });
    if (!party) {
      throw new NotFoundException(`Party '${dto.partyId}' not found`);
    }

    const defaultPriceList = await this.prisma.priceList.findFirst({
      where: { companyId, isDefault: true },
      include: { items: true },
    });
    const partyRateMap = new Map(
      (party.priceList?.items ?? []).map((p) => [p.itemId, toDecimal(p.rate)]),
    );
    const defaultRateMap = new Map(
      (defaultPriceList?.items ?? []).map((p) => [p.itemId, toDecimal(p.rate)]),
    );

    const isInterState = party.stateCode !== company.stateCode;

    // 3. Pre-fetch items + UoMs and compute line taxes using authoritative server rates
    const itemIds = dto.lines.map((l) => l.itemId);
    const items = await this.prisma.item.findMany({
      where: { id: { in: itemIds }, companyId },
      include: { itemUoms: true },
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

      let uomFactor = toDecimal(1);
      if (line.uom !== item.baseUom) {
        const matchedUom = item.itemUoms.find((u) => u.uom === line.uom);
        if (!matchedUom) {
          throw new BadRequestException(`Invalid UoM '${line.uom}' for item '${item.sku}'`);
        }
        uomFactor = toDecimal(matchedUom.factorToBase);
      }

      const baseRate = partyRateMap.get(line.itemId) ?? defaultRateMap.get(line.itemId);
      if (!baseRate) {
        throw new BadRequestException(`No authorized price configured for item '${item.sku}'`);
      }

      const authoritativeRate = roundMoney(baseRate.times(uomFactor));
      const clientRate = toDecimal(line.rate);
      if (clientRate.minus(authoritativeRate).abs().greaterThan(0.01)) {
        throw new BadRequestException(
          `Unauthorized unit rate for item '${item.sku}'. Expected ₹${authoritativeRate.toFixed(2)}`,
        );
      }

      const gstBreakdown = computeLineGst({
        rate: authoritativeRate.toNumber(),
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
        rate: authoritativeRate,
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
      // Lock clientUuid inside transaction so concurrent duplicate submissions return the original order cleanly
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-client:${dto.clientUuid}`}))`;

      const concurrentExisting = await tx.salesOrder.findUnique({
        where: { clientUuid: dto.clientUuid },
        include: {
          party: true,
          lines: { include: { item: true } },
        },
      });
      if (concurrentExisting) {
        if (concurrentExisting.companyId !== companyId) {
          throw new ForbiddenException('Access denied for duplicate clientUuid');
        }
        return concurrentExisting;
      }

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
          salesmanId: resolvedSalesmanId,
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
    filters?: { salesmanId?: string; status?: OrderStatus; partyId?: string; limit?: number; offset?: number },
  ) {
    const take = Math.min(Math.max(1, Number(filters?.limit) || 200), 500);
    const skip = Math.max(0, Number(filters?.offset) || 0);
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
      take,
      skip,
    });
  }

  async getOrder(companyId: string, orderId: string, salesmanId?: string) {
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

    if (salesmanId && order.salesmanId !== salesmanId) {
      throw new ForbiddenException('Access denied: order does not belong to you');
    }

    return order;
  }
}
