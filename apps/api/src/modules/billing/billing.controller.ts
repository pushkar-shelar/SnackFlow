import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Inject,
  ParseIntPipe,
} from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { CreditNoteService } from './credit-note.service.js';
import { CurrentUser, AuthenticatedUser } from '../../core/decorators/current-user.decorator.js';
import { RequirePermission, Public } from '../../core/decorators/require-permission.decorator.js';
import {
  Permission,
  PostInvoiceSchema,
  PostInvoiceDto,
  CreateCreditNoteSchema,
  CreateCreditNoteDto,
  InvoiceStatus,
} from '@snackflow/shared';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';

@Controller('invoices')
export class BillingController {
  constructor(
    @Inject(BillingService) private readonly billingService: BillingService,
    @Inject(CreditNoteService) private readonly creditNoteService: CreditNoteService,
  ) {}

  @RequirePermission(Permission.INVOICE_POST)
  @Post()
  async postInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(PostInvoiceSchema)) dto: PostInvoiceDto,
  ) {
    return this.billingService.postInvoice(user.companyId, dto, user.userId);
  }

  @RequirePermission(Permission.ORDER_READ_ALL, Permission.REPORT_READ)
  @Get()
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

  // T4.1 & T4.2: HMAC-signed expiring invoice share link & UPI QR
  @RequirePermission(Permission.ORDER_READ_ALL, Permission.ORDER_READ_OWN)
  @Get(':id/share')
  async getShareLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.billingService.generateShareLink(user.companyId, id);
  }

  // T4.5: e-Invoice (INV-01 JSON) & e-Way bill JSON
  @RequirePermission(Permission.ORDER_READ_ALL, Permission.REPORT_READ)
  @Get(':id/einvoice')
  async getEInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.billingService.getEInvoiceJson(user.companyId, id);
  }

  // Public authenticated view using HMAC token
  @Public()
  @Get('public/:id')
  async getPublicInvoice(
    @Param('id') id: string,
    @Query('expires', ParseIntPipe) expires: number,
    @Query('sig') sig: string,
  ) {
    return this.billingService.verifyAndGetPublicInvoice(id, expires, sig);
  }

  @RequirePermission(
    Permission.ORDER_READ_OWN,
    Permission.ORDER_READ_ALL,
    Permission.REPORT_READ,
  )
  @Get(':id')
  async getInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.billingService.getInvoice(user.companyId, id);
  }

  @RequirePermission(Permission.INVOICE_CANCEL)
  @Post(':id/credit-note')
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
