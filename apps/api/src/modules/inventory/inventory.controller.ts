import { Controller, Get, Query, Inject, ParseUUIDPipe, BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { CurrentUser, AuthenticatedUser } from '../../core/decorators/current-user.decorator.js';
import { RequirePermission } from '../../core/decorators/require-permission.decorator.js';
import { Permission } from '@snackflow/shared';
import { PrismaService } from '../../prisma/prisma.service.js';

@Controller('inventory')
export class InventoryController {
  constructor(
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @RequirePermission(Permission.REPORT_READ)
  @Get('balances')
  async getBalances(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.stockBalance.findMany({
      where: { companyId: user.companyId },
      include: {
        item: true,
        batch: true,
      },
      orderBy: { item: { sku: 'asc' } },
    });
  }

  @RequirePermission(Permission.REPORT_READ)
  @Get('ledger')
  async getLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Query('itemId', new ParseUUIDPipe({ optional: true })) itemId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const txnAt: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) throw new BadRequestException('Invalid startDate parameter');
      txnAt.gte = start;
    }
    if (endDate) {
      const normalized = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? `${endDate}T23:59:59.999Z` : endDate;
      const end = new Date(normalized);
      if (isNaN(end.getTime())) throw new BadRequestException('Invalid endDate parameter');
      txnAt.lte = end;
    }

    return this.prisma.stockLedger.findMany({
      where: {
        companyId: user.companyId,
        ...(itemId ? { itemId } : {}),
        ...(Object.keys(txnAt).length > 0 ? { txnAt } : {}),
      },
      include: {
        item: true,
        batch: true,
      },
      orderBy: { txnAt: 'desc' },
      take: 250,
    });
  }

  @RequirePermission(Permission.REPORT_READ)
  @Get('reconcile')
  async reconcile(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.reconcileStock(user.companyId);
  }
}
