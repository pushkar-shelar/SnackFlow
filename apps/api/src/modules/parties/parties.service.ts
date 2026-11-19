import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreatePartyDto, validateGstin } from '@snackflow/shared';

@Injectable()
export class PartiesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

  async getParty(companyId: string, partyId: string) {
    return this.prisma.party.findFirst({
      where: { id: partyId, companyId },
      include: { priceList: { include: { items: { include: { item: true } } } } },
    });
  }
}
