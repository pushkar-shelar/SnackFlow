import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Inject,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { ApprovalService } from './approval.service.js';
import { DispatchService } from './dispatch.service.js';
import { CurrentUser, AuthenticatedUser } from '../../core/decorators/current-user.decorator.js';
import { RequirePermission } from '../../core/decorators/require-permission.decorator.js';
import {
  Permission,
  Role,
  CreateOrderSchema,
  CreateOrderDto,
  ApproveOrderSchema,
  ApproveOrderDto,
  DispatchInvoiceSchema,
  DispatchInvoiceDto,
  OrderStatus,
} from '@snackflow/shared';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';

@Controller()
export class OrdersController {
  constructor(
    @Inject(OrdersService) private readonly ordersService: OrdersService,
    @Inject(ApprovalService) private readonly approvalService: ApprovalService,
    @Inject(DispatchService) private readonly dispatchService: DispatchService,
  ) {}

  @RequirePermission(Permission.ORDER_CREATE)
  @Post('orders')
  async createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateOrderSchema)) dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(user.companyId, user.userId, user.role, dto);
  }

  @RequirePermission(Permission.ORDER_READ_OWN, Permission.ORDER_READ_ALL)
  @Get('orders')
  async listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: OrderStatus,
    @Query('partyId', new ParseUUIDPipe({ optional: true })) partyId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const salesmanId = user.role === Role.SALESMAN ? user.userId : undefined;
    const filters: { salesmanId?: string; status?: OrderStatus; partyId?: string; limit?: number; offset?: number } = {};
    if (salesmanId) filters.salesmanId = salesmanId;
    if (status) filters.status = status;
    if (partyId) filters.partyId = partyId;
    if (limit !== undefined) filters.limit = Number(limit);
    if (offset !== undefined) filters.offset = Number(offset);
    return this.ordersService.listOrders(user.companyId, filters);
  }

  @RequirePermission(Permission.ORDER_READ_OWN, Permission.ORDER_READ_ALL)
  @Get('orders/:id')
  async getOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const salesmanId = user.role === Role.SALESMAN ? user.userId : undefined;
    return this.ordersService.getOrder(user.companyId, id, salesmanId);
  }

  @RequirePermission(Permission.ORDER_APPROVE)
  @Post('orders/:id/approve')
  async approveOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ApproveOrderSchema)) dto: ApproveOrderDto,
  ) {
    return this.approvalService.approveOrder(user.companyId, id, dto);
  }

  @RequirePermission(Permission.DISPATCH_CREATE)
  @Post('dispatches')
  async createDispatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(DispatchInvoiceSchema)) dto: DispatchInvoiceDto,
  ) {
    return this.dispatchService.dispatchInvoice(user.companyId, dto.invoiceId, user.userId);
  }

  @RequirePermission(Permission.ORDER_READ_ALL, Permission.REPORT_READ)
  @Get('dispatches')
  async listDispatches(@CurrentUser() user: AuthenticatedUser) {
    return this.dispatchService.listDispatches(user.companyId);
  }
}
