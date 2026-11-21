import { Controller, Post, Get, Param, Body, Inject } from '@nestjs/common';
import { ProductionService } from './production.service.js';
import { CurrentUser, AuthenticatedUser } from '../../core/decorators/current-user.decorator.js';
import { RequirePermission } from '../../core/decorators/require-permission.decorator.js';
import {
  Permission,
  CreateQcCheckpointSchema,
  CreateQcCheckpointDto,
} from '@snackflow/shared';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';

@Controller('production/runs')
export class ProductionController {
  constructor(@Inject(ProductionService) private readonly productionService: ProductionService) {}

  @RequirePermission(Permission.PRODUCTION_RUN)
  @Post(':id/qc')
  async recordQc(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateQcCheckpointSchema)) dto: CreateQcCheckpointDto,
  ) {
    return this.productionService.recordQcCheckpoint(user.companyId, id, user.userId, dto);
  }

  @RequirePermission(Permission.PRODUCTION_RUN, Permission.REPORT_READ)
  @Get(':id/qc')
  async getQc(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.productionService.getQcCheckpoint(user.companyId, id);
  }

  @RequirePermission(Permission.PRODUCTION_RUN)
  @Post('draft')
  async createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { recipeId: string; fgItemId: string; batchFactor?: number },
  ) {
    return this.productionService.createDraftRun(
      user.companyId,
      body.recipeId,
      body.fgItemId,
      body.batchFactor || 1.0,
    );
  }

  @RequirePermission(Permission.PRODUCTION_POST)
  @Post(':id/post')
  async postRun(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      actualInputs: { itemId: string; actualQty: number; uom: string }[];
      goodOutputQty: number;
      damagedPackagingQty?: number;
      cartonsUsed?: number;
    },
  ) {
    return this.productionService.postRun(user.companyId, id, body, user.userId);
  }

  @RequirePermission(Permission.PRODUCTION_CLOSE)
  @Post(':id/close')
  async closeRun(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { overheadAmount: number },
  ) {
    return this.productionService.closeRun(user.companyId, id, body.overheadAmount, user.userId);
  }

  @RequirePermission(Permission.PRODUCTION_POST)
  @Post(':id/reverse')
  async reverseRun(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.productionService.reverseRun(user.companyId, id, user.userId);
  }

  @RequirePermission(Permission.REPORT_READ)
  @Get(':id')
  async getRun(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.productionService.getRun(user.companyId, id);
  }
}
