import { Controller, Get, Inject } from '@nestjs/common';
import { AlertsService } from './alerts.service.js';
import { RequirePermission } from '../../core/decorators/require-permission.decorator.js';
import { Permission } from '@snackflow/shared';

@Controller('alerts')
export class AlertsController {
  constructor(@Inject(AlertsService) private readonly alertsService: AlertsService) {}

  @Get()
  @RequirePermission(Permission.REPORT_READ)
  async getActiveAlerts() {
    return this.alertsService.getActiveAlerts();
  }
}
