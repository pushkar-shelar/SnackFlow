import { Controller, Post, Get, Param, Body, Inject, ParseUUIDPipe } from '@nestjs/common';
import { z } from 'zod';
import { ProductionService } from './production.service.js';
import { CurrentUser, AuthenticatedUser } from '../../core/decorators/current-user.decorator.js';
import { RequirePermission } from '../../core/decorators/require-permission.decorator.js';
import {
  Permission,
  CreateQcCheckpointSchema,
  CreateQcCheckpointDto,
} from '@snackflow/shared';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';

const CreateProductionDraftSchema = z.object({
  recipeId: z.string().uuid(),
  fgItemId: z.string().uuid(),
  batchFactor: z.number().positive().default(1.0),
});

const PostProductionRunSchema = z.object({
  actualInputs: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        actualQty: z.number().nonnegative(),
        uom: z.string().min(1),
      }),
    )
    .min(1),
  goodOutputQty: z.number().nonnegative(),
  damagedPackagingQty: z.number().nonnegative().optional(),
  cartonsUsed: z.number().nonnegative().optional(),
});

const CloseProductionRunSchema = z.object({
  overheadAmount: z.number().nonnegative(),
});

@Controller('production/runs')
export class ProductionController {
  constructor(@Inject(ProductionService) private readonly productionService: ProductionService) {}

  @RequirePermission(Permission.PRODUCTION_RUN)
  @Post(':id/qc')
  async recordQc(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateQcCheckpointSchema)) dto: CreateQcCheckpointDto,
  ) {
    return this.productionService.recordQcCheckpoint(user.companyId, id, user.userId, dto);
  }

  @RequirePermission(Permission.PRODUCTION_RUN, Permission.REPORT_READ)
  @Get(':id/qc')
  async getQc(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productionService.getQcCheckpoint(user.companyId, id);
  }

  @RequirePermission(Permission.PRODUCTION_RUN)
  @Post('draft')
  async createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateProductionDraftSchema))
    body: z.infer<typeof CreateProductionDraftSchema>,
  ) {
    return this.productionService.createDraftRun(
      user.companyId,
      body.recipeId,
      body.fgItemId,
      body.batchFactor,
    );
  }

  @RequirePermission(Permission.PRODUCTION_POST)
  @Post(':id/post')
  async postRun(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PostProductionRunSchema))
    body: z.infer<typeof PostProductionRunSchema>,
  ) {
    return this.productionService.postRun(
      user.companyId,
      id,
      {
        actualInputs: body.actualInputs,
        goodOutputQty: body.goodOutputQty,
        ...(body.damagedPackagingQty !== undefined
          ? { damagedPackagingQty: body.damagedPackagingQty }
          : {}),
        ...(body.cartonsUsed !== undefined ? { cartonsUsed: body.cartonsUsed } : {}),
      },
      user.userId,
    );
  }

  @RequirePermission(Permission.PRODUCTION_CLOSE)
  @Post(':id/close')
  async closeRun(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CloseProductionRunSchema))
    body: z.infer<typeof CloseProductionRunSchema>,
  ) {
    return this.productionService.closeRun(user.companyId, id, body.overheadAmount, user.userId);
  }

  @RequirePermission(Permission.PRODUCTION_POST)
  @Post(':id/reverse')
  async reverseRun(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productionService.reverseRun(user.companyId, id, user.userId);
  }

  @RequirePermission(Permission.REPORT_READ)
  @Get(':id')
  async getRun(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productionService.getRun(user.companyId, id);
  }
}
