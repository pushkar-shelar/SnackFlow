import { Controller, Get, Param, Query, Inject, ParseUUIDPipe } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { CurrentUser, AuthenticatedUser } from '../../core/decorators/current-user.decorator.js';
import { RequirePermission } from '../../core/decorators/require-permission.decorator.js';
import { Permission, ItemKind } from '@snackflow/shared';

@Controller('catalog')
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  @RequirePermission(
    Permission.ORDER_READ_OWN,
    Permission.ORDER_READ_ALL,
    Permission.PRODUCTION_RUN,
    Permission.REPORT_READ,
  )
  @Get('items')
  async listItems(
    @CurrentUser() user: AuthenticatedUser,
    @Query('kind') kind?: ItemKind,
  ) {
    return this.catalogService.listItems(user.companyId, kind);
  }

  @RequirePermission(
    Permission.ORDER_READ_OWN,
    Permission.ORDER_READ_ALL,
    Permission.PRODUCTION_RUN,
    Permission.REPORT_READ,
  )
  @Get('items/:id')
  async getItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.getItem(user.companyId, id);
  }

  @RequirePermission(
    Permission.ORDER_READ_OWN,
    Permission.ORDER_READ_ALL,
    Permission.MASTER_MANAGE,
  )
  @Get('price-lists')
  async listPriceLists(@CurrentUser() user: AuthenticatedUser) {
    return this.catalogService.listPriceLists(user.companyId);
  }

  @RequirePermission(
    Permission.ORDER_READ_OWN,
    Permission.ORDER_READ_ALL,
    Permission.MASTER_MANAGE,
  )
  @Get('price-lists/:id')
  async getPriceList(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.getPriceList(user.companyId, id);
  }

  @RequirePermission(Permission.ORDER_READ_OWN, Permission.ORDER_READ_ALL)
  @Get('rate')
  async getRate(
    @CurrentUser() user: AuthenticatedUser,
    @Query('partyId', ParseUUIDPipe) partyId: string,
    @Query('itemId', ParseUUIDPipe) itemId: string,
  ) {
    const rate = await this.catalogService.getPartyEffectiveRate(user.companyId, partyId, itemId);
    return { partyId, itemId, rate };
  }
}
