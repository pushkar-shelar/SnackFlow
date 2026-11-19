import { Module } from '@nestjs/common';
import { PartiesService } from './parties.service.js';
import { PartiesController } from './parties.controller.js';

@Module({
  controllers: [PartiesController],
  providers: [PartiesService],
  exports: [PartiesService],
})
export class PartiesModule {}
