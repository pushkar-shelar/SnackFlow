import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Inject,
} from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { CreditNoteService } from './credit-note.service.js';
import { CurrentUser, AuthenticatedUser } from '../../core/decorators/current-user.decorator.js';
import { RequirePermission } from '../../core/decorators/require-permission.decorator.js';
import {
  Permission,
  PostInvoiceSchema,
  PostInvoiceDto,
  CreateCreditNoteSchema,
  CreateCreditNoteDto,
  InvoiceStatus,
} from '@snackflow/shared';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';

@Controller()
export class BillingController {
  constructor(
    @Inject(BillingService) private readonly billingService: BillingService,
    @Inject(CreditNoteService) private readonly creditNoteService: CreditNoteService,
  ) {}

  @RequirePermission(Permission.INVOICE_POST)
  @Post('invoices')
  async postInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(PostInvoiceSchema)) dto: PostInvoiceDto,
  ) {
    return this.billingService.postInvoice(user.companyId, dto, user.userId);
  }

  @RequirePermission(Permission.ORDER_READ_ALL, Permission.REPORT_READ)
  @Get('invoices')
  async listInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query('partyId') partyId?: string,
    @Query('status') status?: InvoiceStatus,
  ) {
    const filters: { partyId?: string; status?: InvoiceStatus } = {};
    if (partyId) filters.partyId = partyId;
    if (status) filters.status = status;
    return this.billingService.listInvoices(user.companyId, filters);
  }

  @RequirePermission(
    Permission.ORDER_READ_OWN,
    Permission.ORDER_READ_ALL,
    Permission.REPORT_READ,
  )
  @Get('invoices/:id')
  async getInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.billingService.getInvoice(user.companyId, id);
  }

  @RequirePermission(Permission.INVOICE_CANCEL)
  @Post('invoices/:id/credit-note')
  async createCreditNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateCreditNoteSchema)) dto: CreateCreditNoteDto,
  ) {
    return this.creditNoteService.createCreditNote(user.companyId, id, dto, user.userId);
  }

  @RequirePermission(Permission.ORDER_READ_ALL, Permission.REPORT_READ)
  @Get('credit-notes')
  async listCreditNotes(@CurrentUser() user: AuthenticatedUser) {
    return this.creditNoteService.listCreditNotes(user.companyId);
  }
}
