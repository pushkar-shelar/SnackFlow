import { Controller, Post, Get, Param, Query, Body, Inject, ParseUUIDPipe } from '@nestjs/common';
import { PartiesService } from './parties.service.js';
import { CurrentUser, AuthenticatedUser } from '../../core/decorators/current-user.decorator.js';
import { RequirePermission } from '../../core/decorators/require-permission.decorator.js';
import {
  Permission,
  CreatePartySchema,
  CreatePartyDto,
  CreateRetailerApplicationSchema,
  CreateRetailerApplicationDto,
  ApproveRetailerApplicationSchema,
  ApproveRetailerApplicationDto,
  Role,
} from '@snackflow/shared';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';

@Controller('parties')
export class PartiesController {
  constructor(@Inject(PartiesService) private readonly partiesService: PartiesService) { }

  @RequirePermission(Permission.MASTER_MANAGE)
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreatePartySchema)) dto: CreatePartyDto,
  ) {
    return this.partiesService.createParty(user.companyId, dto);
  }

  @RequirePermission(
    Permission.ORDER_READ_OWN,
    Permission.ORDER_READ_ALL,
    Permission.MASTER_MANAGE,
    Permission.REPORT_READ,
  )
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('kind') kind?: string,
  ) {
    // Salesman sees only assigned customers per §6 data scoping
    const salesmanId = user.role === Role.SALESMAN ? user.userId : undefined;
    return this.partiesService.listParties(user.companyId, kind, salesmanId);
  }

  // Salesman submits application: POST /api/v1/parties/applications
  @RequirePermission(Permission.ORDER_CREATE)
  @Post('applications')
  async apply(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateRetailerApplicationSchema)) dto: CreateRetailerApplicationDto,
  ) {
    return this.partiesService.applyRetailer(user.companyId, user.userId, dto);
  }

  // List applications: GET /api/v1/parties/applications
  @RequirePermission(Permission.ORDER_READ_OWN, Permission.MASTER_MANAGE)
  @Get('applications')
  async listApplications(@CurrentUser() user: AuthenticatedUser) {
    // If salesman, show only their own applications; Admin/Owner sees all
    const salesmanId = user.role === Role.SALESMAN ? user.userId : undefined;
    return this.partiesService.listApplications(user.companyId, salesmanId);
  }

  // Admin verifies and approves application: POST /api/v1/parties/applications/:id/approve
  @RequirePermission(Permission.MASTER_MANAGE)
  @Post('applications/:id/approve')
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ApproveRetailerApplicationSchema)) dto: ApproveRetailerApplicationDto,
  ) {
    return this.partiesService.approveApplication(user.companyId, id, dto);
  }

  // Admin rejects application: POST /api/v1/parties/applications/:id/reject
  @RequirePermission(Permission.MASTER_MANAGE)
  @Post('applications/:id/reject')
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.partiesService.rejectApplication(user.companyId, id);
  }

  @RequirePermission(
    Permission.ORDER_READ_OWN,
    Permission.ORDER_READ_ALL,
    Permission.MASTER_MANAGE,
    Permission.REPORT_READ,
  )
  @Get(':id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const salesmanId = user.role === Role.SALESMAN ? user.userId : undefined;
    return this.partiesService.getParty(user.companyId, id, salesmanId);
  }
}
