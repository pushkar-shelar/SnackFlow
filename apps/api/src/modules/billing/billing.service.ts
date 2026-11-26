import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
  Inject,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
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
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(ConfigService) private readonly configService?: ConfigService,
  ) {}

  private getShareSecret(): string {
    const secret =
      this.configService?.get<string>('HMAC_SHARE_SECRET') || process.env.HMAC_SHARE_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('HMAC_SHARE_SECRET is not configured');
    }
    return secret;
  }

  async postInvoice(companyId: string, dto: PostInvoiceDto, _createdBy?: string) {
    const fy = getFinancialYear();

    return this.prisma.$transaction(async (tx) => {
      // Lock sales order row inside transaction to prevent duplicate concurrent invoices for the same order
      const lockedOrder = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM sales_order WHERE id = ${dto.orderId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE
      `;
      if (lockedOrder.length === 0) {
        throw new NotFoundException(`Sales order '${dto.orderId}' not found`);
      }

      const order = await tx.salesOrder.findFirst({
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

      let taxableTotal = toDecimal(0);
      let cgstTotal = toDecimal(0);
      let sgstTotal = toDecimal(0);
      let igstTotal = toDecimal(0);
      let grandTotal = toDecimal(0);

      const invoiceLinesData = order.lines.map((line) => {
        const gst = computeLineGst({
          qty: line.qty,
          rate: line.rate,
          gstRate: line.gstRate,
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
          qty: line.qty,
          uom: line.uom,
          rate: line.rate,
          taxable: gst.taxable,
          gstRate: line.gstRate,
          cgst: gst.cgst,
          sgst: gst.sgst,
          igst: gst.igst,
          total: gst.total,
        };
      });

      const roundedGrandTotal = roundMoney(grandTotal);
      const roundOff = roundedGrandTotal.minus(grandTotal);

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

      // Generate SHA-256 IRN & Signed QR per NIC e-Invoice specification
      const plainIrn = `33AAAAA0000A1Z5${fy}INV${invoiceNumber}`;
      const mockIrn = crypto.createHash('sha256').update(plainIrn).digest('hex');
      const mockSignedQr = `MOCK_SIGNED_QR_${mockIrn.substring(0, 32)}`;

      const createdInvoice = await tx.invoice.create({
        data: {
          companyId,
          orderId: order.id,
          number: invoiceNumber,
          fy,
          placeOfSupply: order.party.stateCode,
          supplyType,
          taxable: taxableTotal,
          cgst: cgstTotal,
          sgst: sgstTotal,
          igst: igstTotal,
          roundOff,
          total: roundedGrandTotal,
          status: InvoiceStatus.POSTED,
          irn: mockIrn,
          signedQr: mockSignedQr,
          lines: {
            create: invoiceLinesData,
          },
        },
        include: {
          lines: { include: { item: true } },
          order: { include: { party: true } },
        },
      });

      return createdInvoice;
    });
  }

  async getInvoice(companyId: string, id: string, salesmanId?: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: {
        lines: {
          include: {
            item: true,
            batch: true,
          },
        },
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

    if (
      salesmanId &&
      invoice.order?.salesmanId !== salesmanId &&
      invoice.order?.party?.assignedSalesmanId !== salesmanId
    ) {
      throw new ForbiddenException('Access denied: invoice does not belong to you');
    }

    return invoice;
  }

  async listInvoices(
    companyId: string,
    filters?: { partyId?: string; status?: InvoiceStatus; limit?: number; offset?: number },
  ) {
    const take = Math.min(Math.max(1, Number(filters?.limit) || 200), 500);
    const skip = Math.max(0, Number(filters?.offset) || 0);
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
      take,
      skip,
    });
  }

  // T4.1 & T4.2: HMAC-signed share link and UPI deep link
  async generateShareLink(companyId: string, invoiceId: string, salesmanId?: string) {
    const invoice = await this.getInvoice(companyId, invoiceId, salesmanId);
    const secret = this.getShareSecret();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${invoice.id}:${expiresAt}`);
    const signature = hmac.digest('hex');

    const webBaseUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';
    const publicUrl = `${webBaseUrl}/public/invoices/${invoice.id}?expires=${expiresAt}&sig=${signature}`;

    const customerName = invoice.order?.party?.name || 'Customer';
    const phone = invoice.order?.party?.phone?.replace(/\D/g, '') || '';
    const grandTotal = toDecimal(invoice.total).toFixed(2);
    const invoiceNo = invoice.number;

    // NPCI / BharatQR UPI deep-link specification
    const upiUri = `upi://pay?pa=srimurugansnacks@okhdfcbank&pn=Sri%20Murugan%20Snacks&am=${grandTotal}&cu=INR&tn=Invoice%20${encodeURIComponent(
      invoiceNo,
    )}`;

    const text = `வணக்கம் ${customerName}! Sri Murugan Snacks-ல் இருந்து உங்கள் ரசீது ${invoiceNo} (தொகை: ₹${grandTotal}) தயாராக உள்ளது. பார்க்க: ${publicUrl} | UPI கட்டணம் செலுத்த: ${upiUri}`;
    const whatsappUrl = `https://wa.me/${
      phone ? (phone.startsWith('91') ? phone : '91' + phone) : ''
    }?text=${encodeURIComponent(text)}`;

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoiceNo,
      expiresAt: new Date(expiresAt).toISOString(),
      publicUrl,
      whatsappUrl,
      upiUri,
      signature,
    };
  }

  async verifyAndGetPublicInvoice(invoiceId: string, expires: number, signature?: string) {
    if (!signature || typeof signature !== 'string') {
      throw new BadRequestException('Missing invoice share link signature');
    }
    if (Date.now() > expires) {
      throw new UnauthorizedException('Invoice share link has expired');
    }

    const secret = this.getShareSecret();
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${invoiceId}:${expires}`);
    const expectedSig = hmac.digest('hex');

    if (
      signature.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
    ) {
      throw new UnauthorizedException('Invalid invoice share link signature');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        number: true,
        createdAt: true,
        status: true,
        supplyType: true,
        placeOfSupply: true,
        irn: true,
        taxable: true,
        cgst: true,
        sgst: true,
        igst: true,
        roundOff: true,
        total: true,
        lines: {
          select: {
            id: true,
            itemId: true,
            hsn: true,
            qty: true,
            uom: true,
            rate: true,
            taxable: true,
            gstRate: true,
            cgst: true,
            sgst: true,
            igst: true,
            total: true,
            item: { select: { name: true, sku: true } },
          },
        },
        order: {
          select: {
            party: {
              select: {
                name: true,
                address: true,
                gstin: true,
                stateCode: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  // T4.5: e-Invoice (INV-01) JSON schema & e-Way bill JSON
  async getEInvoiceJson(companyId: string, invoiceId: string) {
    const invoice = await this.getInvoice(companyId, invoiceId);
    const sellerGstin = '33AAAAA0000A1Z5';
    const totalAmount = toDecimal(invoice.total).toNumber();
    const isEWayBillRequired = totalAmount > 50000;

    return {
      Version: '1.1',
      TranDtls: {
        TaxSch: 'GST',
        SupTyp: invoice.supplyType === SupplyType.INTER ? 'INTER' : 'B2B',
      },
      DocDtls: {
        Typ: 'INV',
        No: invoice.number,
        Dt: invoice.createdAt.toISOString().split('T')[0],
      },
      SellerDtls: {
        Gstin: sellerGstin,
        LglNm: 'Sri Murugan Snacks',
        TrdNm: 'Sri Murugan Snacks',
        Addr1: 'Factory Road, Madurai',
        Loc: 'Madurai',
        Pin: 625001,
        Stcd: '33',
      },
      BuyerDtls: {
        Gstin: invoice.order?.party?.gstin || 'URP',
        LglNm: invoice.order?.party?.name,
        Pos: invoice.placeOfSupply,
        Addr1: invoice.order?.party?.address || 'Tamil Nadu',
        Stcd: invoice.order?.party?.stateCode || '33',
      },
      ItemList: invoice.lines.map((l, idx) => ({
        ItemNo: idx + 1,
        PrdDesc: l.item.name,
        IsServc: 'N',
        HsnCd: l.hsn,
        Qty: toDecimal(l.qty).toNumber(),
        Unit: l.uom,
        UnitPrice: toDecimal(l.rate).toNumber(),
        TotAmt: toDecimal(l.taxable).toNumber(),
        GstRt: toDecimal(l.gstRate).toNumber(),
        CgstAmt: toDecimal(l.cgst).toNumber(),
        SgstAmt: toDecimal(l.sgst).toNumber(),
        IgstAmt: toDecimal(l.igst).toNumber(),
        TotItemVal: toDecimal(l.total).toNumber(),
      })),
      ValDtls: {
        AssVal: toDecimal(invoice.taxable).toNumber(),
        CgstVal: toDecimal(invoice.cgst).toNumber(),
        SgstVal: toDecimal(invoice.sgst).toNumber(),
        IgstVal: toDecimal(invoice.igst).toNumber(),
        RndOffAmt: toDecimal(invoice.roundOff).toNumber(),
        TotInvVal: totalAmount,
      },
      IRN: invoice.irn,
      SignedQRCode: invoice.signedQr,
      EWayBill: isEWayBillRequired
        ? {
            EwbNo: `99${Date.now()}`.substring(0, 12),
            EwbDt: new Date().toISOString(),
            ValidUpto: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          }
        : null,
    };
  }
}
