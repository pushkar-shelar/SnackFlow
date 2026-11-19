import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CreatePaymentDto,
  InvoiceStatus,
  toDecimal,
  roundMoney,
  getFinancialYear,
  formatInvoiceNumber,
} from '@snackflow/shared';

@Injectable()
export class PaymentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createPayment(companyId: string, dto: CreatePaymentDto) {
    const party = await this.prisma.party.findFirst({
      where: { id: dto.partyId, companyId },
    });

    if (!party) {
      throw new NotFoundException(`Party '${dto.partyId}' not found`);
    }

    const totalPaymentAmount = roundMoney(dto.amount);
    if (totalPaymentAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const fy = getFinancialYear();

    return this.prisma.$transaction(async (tx) => {
      // 1. Sequence allocation for PAY
      const seq = await tx.$queryRaw<Array<{ next_no: number }>>`
        INSERT INTO document_sequence (id, company_id, doc_type, fy, next_no, updated_at)
        VALUES (gen_random_uuid(), ${companyId}::uuid, 'PAY', ${fy}, 2, NOW())
        ON CONFLICT (company_id, doc_type, fy)
        DO UPDATE SET next_no = document_sequence.next_no + 1, updated_at = NOW()
        RETURNING next_no - 1 AS next_no
      `;
      const nextNo = seq[0]?.next_no ?? 1;
      const paymentNo = formatInvoiceNumber(nextNo, fy, 'PAY');

      // 2. Determine allocations: manual or automatic FIFO oldest-first
      const allocationsToCreate: Array<{ invoiceId: string; amount: number }> = [];

      if (dto.allocations && dto.allocations.length > 0) {
        let sumAlloc = toDecimal(0);
        for (const alloc of dto.allocations) {
          sumAlloc = sumAlloc.plus(toDecimal(alloc.amount));
          allocationsToCreate.push({
            invoiceId: alloc.invoiceId,
            amount: roundMoney(alloc.amount).toNumber(),
          });
        }
        if (!sumAlloc.equals(totalPaymentAmount)) {
          throw new BadRequestException(
            `Sum of allocations (${sumAlloc.toNumber()}) does not match payment amount (${totalPaymentAmount.toNumber()})`,
          );
        }
      } else {
        // Automatic FIFO allocation against oldest unpaid posted invoices
        const postedInvoices = await tx.invoice.findMany({
          where: {
            companyId,
            order: { partyId: dto.partyId },
            status: InvoiceStatus.POSTED,
          },
          include: {
            paymentAllocations: true,
          },
          orderBy: { createdAt: 'asc' },
        });

        let remainingToAllocate = totalPaymentAmount;

        for (const inv of postedInvoices) {
          if (remainingToAllocate.lessThanOrEqualTo(0)) break;

          const alreadyPaid = inv.paymentAllocations.reduce(
            (sum, a) => sum.plus(toDecimal(a.amount)),
            toDecimal(0),
          );
          const unpaid = toDecimal(inv.total).minus(alreadyPaid);

          if (unpaid.greaterThan(0)) {
            const allocAmt = remainingToAllocate.lessThan(unpaid)
              ? remainingToAllocate
              : unpaid;

            allocationsToCreate.push({
              invoiceId: inv.id,
              amount: roundMoney(allocAmt).toNumber(),
            });

            remainingToAllocate = remainingToAllocate.minus(allocAmt);
          }
        }
      }

      // 3. Create Payment record
      const payment = await tx.payment.create({
        data: {
          companyId,
          partyId: dto.partyId,
          paymentNo,
          mode: dto.mode,
          reference: dto.reference,
          amount: totalPaymentAmount.toNumber(),
          allocations: {
            create: allocationsToCreate,
          },
        },
        include: {
          allocations: {
            include: {
              invoice: true,
            },
          },
          party: true,
        },
      });

      return payment;
    });
  }

  async listPayments(companyId: string, partyId?: string) {
    return this.prisma.payment.findMany({
      where: {
        companyId,
        ...(partyId ? { partyId } : {}),
      },
      include: {
        party: true,
        allocations: {
          include: {
            invoice: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async getPartyOutstanding(companyId: string, partyId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        order: { partyId },
        status: InvoiceStatus.POSTED,
      },
      include: {
        paymentAllocations: true,
      },
    });

    let totalInvoiced = toDecimal(0);
    let totalReceived = toDecimal(0);

    for (const inv of invoices) {
      totalInvoiced = totalInvoiced.plus(toDecimal(inv.total));
      for (const alloc of inv.paymentAllocations) {
        totalReceived = totalReceived.plus(toDecimal(alloc.amount));
      }
    }

    const outstanding = roundMoney(totalInvoiced.minus(totalReceived));

    return {
      partyId,
      totalInvoiced: roundMoney(totalInvoiced).toNumber(),
      totalReceived: roundMoney(totalReceived).toNumber(),
      outstanding: outstanding.toNumber(),
    };
  }
}
