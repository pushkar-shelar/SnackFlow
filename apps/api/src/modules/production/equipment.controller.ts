import { Controller, Post, Get, Param, Body, Inject } from '@nestjs/common';
import { ProductionService } from './production.service.js';
import { CurrentUser, AuthenticatedUser } from '../../core/decorators/current-user.decorator.js';
import { RequirePermission } from '../../core/decorators/require-permission.decorator.js';
import {
  Permission,
  LogEquipmentDowntimeSchema,
  LogEquipmentDowntimeDto,
  ResolveEquipmentDowntimeSchema,
  ResolveEquipmentDowntimeDto,
} from '@snackflow/shared';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';

@Controller('production/equipment')
export class EquipmentController {
  constructor(@Inject(ProductionService) private readonly productionService: ProductionService) {}

  @RequirePermission(Permission.PRODUCTION_RUN, Permission.REPORT_READ)
  @Get()
  async listEquipment(@CurrentUser() user: AuthenticatedUser) {
    return this.productionService.listEquipment(user.companyId);
  }

  @RequirePermission(Permission.PRODUCTION_RUN)
  @Post('downtime')
  async logDowntime(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(LogEquipmentDowntimeSchema)) dto: LogEquipmentDowntimeDto,
  ) {
    return this.productionService.logDowntime(user.companyId, user.userId, dto);
  }

  @RequirePermission(Permission.PRODUCTION_RUN)
  @Post('downtime/:id/resolve')
  async resolveDowntime(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ResolveEquipmentDowntimeSchema)) dto: ResolveEquipmentDowntimeDto,
  ) {
    return this.productionService.resolveDowntime(user.companyId, id, dto);
  }
}
