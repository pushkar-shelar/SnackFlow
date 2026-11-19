import { Controller, Post, Get, Param, Query, Body, Inject } from '@nestjs/common';
import { PartiesService } from './parties.service.js';
import { CurrentUser, AuthenticatedUser } from '../../core/decorators/current-user.decorator.js';
import { RequirePermission } from '../../core/decorators/require-permission.decorator.js';
import { Permission, CreatePartySchema, CreatePartyDto, Role } from '@snackflow/shared';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';

@Controller('parties')
export class PartiesController {
  constructor(@Inject(PartiesService) private readonly partiesService: PartiesService) {}

  @RequirePermission(Permission.MASTER_MANAGE)
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreatePartySchema)) dto: CreatePartyDto,
  ) {
    return this.partiesService.createParty(user.companyId, dto);
  }

  @RequirePermission(Permission.ORDER_READ_OWN)
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('kind') kind?: string,
  ) {
    // Salesman sees only assigned customers per §6 data scoping
    const salesmanId = user.role === Role.SALESMAN ? user.userId : undefined;
    return this.partiesService.listParties(user.companyId, kind, salesmanId);
  }

  @RequirePermission(Permission.ORDER_READ_OWN)
  @Get(':id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.partiesService.getParty(user.companyId, id);
  }
}
