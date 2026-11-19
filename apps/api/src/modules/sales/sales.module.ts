import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { ApprovalService } from './approval.service.js';
import { DispatchService } from './dispatch.service.js';
import { OrdersController } from './orders.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [InventoryModule],
  controllers: [OrdersController],
  providers: [OrdersService, ApprovalService, DispatchService],
  exports: [OrdersService, ApprovalService, DispatchService],
})
export class SalesModule {}
