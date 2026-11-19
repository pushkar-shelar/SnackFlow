import { Module } from '@nestjs/common';
import { ProductionService } from './production.service.js';
import { ProductionController } from './production.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [InventoryModule],
  controllers: [ProductionController],
  providers: [ProductionService],
  exports: [ProductionService],
})
export class ProductionModule {}
