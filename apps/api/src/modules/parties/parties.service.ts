import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CreatePartyDto,
  validateGstin,
  CreateRetailerApplicationDto,
  ApproveRetailerApplicationDto,
  PartyKind,
} from '@snackflow/shared';

@Injectable()
export class PartiesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) { }

  async createParty(companyId: string, dto: CreatePartyDto) {
    if (dto.gstin && !validateGstin(dto.gstin)) {
      throw new BadRequestException(`Invalid GSTIN '${dto.gstin}' checksum`);
    }

    return this.prisma.party.create({
      data: {
        companyId,
        name: dto.name,
        kind: dto.kind,
        gstin: dto.gstin || null,
        stateCode: dto.stateCode,
        address: dto.address,
        phone: dto.phone || null,
        email: dto.email || null,
        priceListId: dto.priceListId || null,
        assignedSalesmanId: dto.assignedSalesmanId || null,
        creditDays: dto.creditDays,
      },
      include: { priceList: true },
    });
  }

  async listParties(companyId: string, kind?: string, salesmanId?: string) {
    return this.prisma.party.findMany({
      where: {
        companyId,
        ...(kind ? { kind: kind as any } : {}),
        ...(salesmanId ? { assignedSalesmanId: salesmanId } : {}),
      },
      include: { priceList: true },
      orderBy: { name: 'asc' },
    });
  }

  async getParty(companyId: string, partyId: string, salesmanId?: string) {
    const party = await this.prisma.party.findFirst({
      where: { id: partyId, companyId },
      include: { priceList: { include: { items: { include: { item: true } } } } },
    });
    if (!party) {
      throw new NotFoundException(`Party '${partyId}' not found`);
    }
    if (salesmanId && party.assignedSalesmanId !== salesmanId) {
      throw new ForbiddenException('Access denied: party is not assigned to you');
    }
    return party;
  }
  // 1. Salesman submits a new store application
  async applyRetailer(companyId: string, salesmanId: string, dto: CreateRetailerApplicationDto) {
    if (dto.gstin && !validateGstin(dto.gstin)) {
      throw new BadRequestException(`Invalid GSTIN '${dto.gstin}' checksum`);
    }

    return this.prisma.retailerApplication.create({
      data: {
        companyId,
        salesmanId,
        storeName: dto.storeName,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        address: dto.address,
        stateCode: dto.stateCode,
        gstin: dto.gstin ?? null,
        geoLat: dto.geoLat ?? null,
        geoLng: dto.geoLng ?? null,
        status: 'PENDING',
      },
    });
  }

  // 2. Query applications (Salesman sees own; Admin sees all)
  async listApplications(companyId: string, salesmanId?: string) {
    return this.prisma.retailerApplication.findMany({
      where: {
        companyId,
        ...(salesmanId ? { salesmanId } : {}),
      },
      include: {
        salesman: { select: { id: true, name: true, email: true } },
        party: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 3. Admin verifies and approves the application
  async approveApplication(
    companyId: string,
    applicationId: string,
    dto: ApproveRetailerApplicationDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Lock application row inside transaction to serialize concurrent approve/reject decisions
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM retailer_application WHERE id = ${applicationId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new BadRequestException('Application not found');
      }

      // Step A: Find the application and verify it's still PENDING
      const app = await tx.retailerApplication.findFirst({
        where: { id: applicationId, companyId },
      });
      if (!app) {
        throw new BadRequestException('Application not found');
      }
      if (app.status !== 'PENDING') {
        throw new BadRequestException('Application is already processed');
      }

      // Step B: Create the official Party customer record
      const party = await tx.party.create({
        data: {
          companyId,
          name: app.storeName,
          kind: PartyKind.CUSTOMER_RETAILER,
          phone: app.phone,
          address: app.address,
          stateCode: app.stateCode,
          gstin: app.gstin,
          creditDays: dto.creditDays,
          assignedSalesmanId: app.salesmanId, // Links this customer to the salesman who applied!
          priceListId: dto.priceListId || null,
        },
      });

      // Step C: Mark the application as APPROVED and link the party ID
      await tx.retailerApplication.update({
        where: { id: applicationId },
        data: {
          status: 'APPROVED',
          createdPartyId: party.id,
        },
      });

      return party;
    });
  }

  async rejectApplication(companyId: string, applicationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM retailer_application WHERE id = ${applicationId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new NotFoundException('Application not found');
      }

      const app = await tx.retailerApplication.findFirst({
        where: { id: applicationId, companyId },
      });
      if (!app) {
        throw new NotFoundException('Application not found');
      }
      if (app.status !== 'PENDING') {
        throw new BadRequestException('Application is already processed');
      }
      return tx.retailerApplication.update({
        where: { id: applicationId },
        data: { status: 'REJECTED' },
      });
    });
  }
}
