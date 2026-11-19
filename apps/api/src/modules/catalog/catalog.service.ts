import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ItemKind } from '@snackflow/shared';

@Injectable()
export class CatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listItems(companyId: string, kind?: ItemKind) {
    return this.prisma.item.findMany({
      where: {
        companyId,
        ...(kind ? { kind } : {}),
      },
      include: {
        itemUoms: true,
        recipeLines: true,
        packSpecs: {
          include: {
            packSpecLines: {
              include: {
                packagingItem: true,
              },
            },
          },
        },
      },
      orderBy: { sku: 'asc' },
    });
  }

  async getItem(companyId: string, id: string) {
    const item = await this.prisma.item.findFirst({
      where: { id, companyId },
      include: {
        itemUoms: true,
        recipeLines: {
          include: {
            recipe: true,
          },
        },
        packSpecs: {
          include: {
            packSpecLines: {
              include: {
                packagingItem: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Item with id '${id}' not found`);
    }

    return item;
  }

  async listPriceLists(companyId: string) {
    return this.prisma.priceList.findMany({
      where: { companyId },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getPriceList(companyId: string, id: string) {
    const priceList = await this.prisma.priceList.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    if (!priceList) {
      throw new NotFoundException(`Price list with id '${id}' not found`);
    }

    return priceList;
  }

  async getPartyEffectiveRate(companyId: string, partyId: string, itemId: string): Promise<string> {
    const party = await this.prisma.party.findFirst({
      where: { id: partyId, companyId },
      include: {
        priceList: {
          include: {
            items: {
              where: { itemId },
            },
          },
        },
      },
    });

    if (party?.priceList?.items && party.priceList.items.length > 0) {
      return party.priceList.items[0]!.rate.toFixed(2);
    }

    // Fall back to default price list
    const defaultList = await this.prisma.priceList.findFirst({
      where: { companyId, isDefault: true },
      include: {
        items: {
          where: { itemId },
        },
      },
    });

    if (defaultList?.items && defaultList.items.length > 0) {
      return defaultList.items[0]!.rate.toFixed(2);
    }

    throw new NotFoundException(`No price configured for item '${itemId}' and party '${partyId}'`);
  }
}
