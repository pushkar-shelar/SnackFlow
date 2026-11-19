import { Module } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { CreditNoteService } from './credit-note.service.js';
import { BillingController } from './billing.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [InventoryModule],
  controllers: [BillingController],
  providers: [BillingService, CreditNoteService],
  exports: [BillingService, CreditNoteService],
})
export class BillingModule {}
