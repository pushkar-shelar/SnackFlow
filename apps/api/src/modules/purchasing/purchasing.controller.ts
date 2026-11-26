import { Controller, Post, Get, Body, Query, Inject } from '@nestjs/common';
import { PurchasingService } from './purchasing.service.js';
import { CurrentUser, AuthenticatedUser } from '../../core/decorators/current-user.decorator.js';
import { RequirePermission } from '../../core/decorators/require-permission.decorator.js';
import { Permission, CreatePurchaseSchema, CreatePurchaseDto } from '@snackflow/shared';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';

@Controller('purchases')
export class PurchasingController {
  constructor(@Inject(PurchasingService) private readonly purchasingService: PurchasingService) {}

  @RequirePermission(Permission.PURCHASE_CREATE)
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreatePurchaseSchema)) dto: CreatePurchaseDto,
  ) {
    return this.purchasingService.createPurchase(user.companyId, dto, user.userId);
  }

  @RequirePermission(Permission.REPORT_READ)
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.purchasingService.listPurchases(
      user.companyId,
      limit !== undefined ? Number(limit) : undefined,
      offset !== undefined ? Number(offset) : undefined,
    );
  }
}
