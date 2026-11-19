import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Inject,
} from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { CurrentUser, AuthenticatedUser } from '../../core/decorators/current-user.decorator.js';
import { RequirePermission } from '../../core/decorators/require-permission.decorator.js';
import {
  Permission,
  CreatePaymentSchema,
  CreatePaymentDto,
} from '@snackflow/shared';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';

@Controller()
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @RequirePermission(Permission.PAYMENT_CREATE)
  @Post('payments')
  async createPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreatePaymentSchema)) dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(user.companyId, dto);
  }

  @RequirePermission(Permission.ORDER_READ_ALL, Permission.REPORT_READ)
  @Get('payments')
  async listPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('partyId') partyId?: string,
  ) {
    return this.paymentsService.listPayments(user.companyId, partyId);
  }

  @RequirePermission(
    Permission.ORDER_READ_OWN,
    Permission.ORDER_READ_ALL,
    Permission.REPORT_READ,
  )
  @Get('parties/:partyId/outstanding')
  async getPartyOutstanding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('partyId') partyId: string,
  ) {
    return this.paymentsService.getPartyOutstanding(user.companyId, partyId);
  }
}
