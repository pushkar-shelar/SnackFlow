import { Controller, Get, Query, Inject } from '@nestjs/common';
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
    @Query('itemId') itemId?: string,
  ) {
    return this.prisma.stockLedger.findMany({
      where: {
        companyId: user.companyId,
        ...(itemId ? { itemId } : {}),
      },
      include: {
        item: true,
        batch: true,
      },
      orderBy: { txnAt: 'desc' },
      take: 100,
    });
  }

  @RequirePermission(Permission.REPORT_READ)
  @Get('reconcile')
  async reconcile(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.reconcileStock(user.companyId);
  }
}
