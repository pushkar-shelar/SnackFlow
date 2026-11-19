import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaReadService } from '../../prisma/prisma-read.service.js';
import { toDecimal } from '@snackflow/shared';
import Decimal from 'decimal.js';

export interface SystemAlert {
  id: string;
  type: 'PRODUCTION_VARIANCE' | 'LOW_STOCK_REORDER' | 'UNPAID_OVERDUE';
  severity: 'HIGH' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  entityId?: string;
  createdAt: string;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(@Inject(PrismaReadService) private readonly prismaRead: PrismaReadService) {}

  async getActiveAlerts(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    // 1. Check for Low Stock Reorder Alerts
    const items = await this.prismaRead.item.findMany({
      where: {
        reorderLevel: { not: null },
      },
      include: {
        stockBalances: true,
      },
    });

    for (const item of items) {
      if (item.reorderLevel) {
        const currentQty = item.stockBalances.reduce(
          (sum, b) => sum.plus(toDecimal(b.qty)),
          new Decimal(0),
        );
        const reorderThreshold = toDecimal(item.reorderLevel);

        if (currentQty.lessThanOrEqualTo(reorderThreshold)) {
          alerts.push({
            id: `low-stock-${item.id}`,
            type: 'LOW_STOCK_REORDER',
            severity: currentQty.isZero() ? 'HIGH' : 'WARNING',
            title: `Low Stock Reorder Alert: ${item.name}`,
            message: `Current balance (${currentQty.toFixed(2)} ${item.baseUom}) has dropped below the reorder threshold of ${reorderThreshold.toFixed(2)} ${item.baseUom}. Place purchase order.`,
            entityId: item.id,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // 2. Check for Production Run Variances (> 3%)
    const recentRuns = await this.prismaRead.productionRun.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        inputs: {
          where: { flagged: true },
          include: { item: true },
        },
        outputs: true,
      },
    });

    for (const run of recentRuns) {
      // Flagged inputs
      for (const input of run.inputs) {
        alerts.push({
          id: `var-input-${input.id}`,
          type: 'PRODUCTION_VARIANCE',
          severity: 'WARNING',
          title: `Material Consumption Variance (${run.number})`,
          message: `${input.item.name}: actual consumption of ${toDecimal(input.actualQty).toFixed(2)} ${input.uom} exceeded standard recipe by ${toDecimal(input.variancePct).toFixed(1)}%.`,
          entityId: run.id,
          createdAt: run.createdAt.toISOString(),
        });
      }

      // Flagged yield
      const output = run.outputs[0];
      if (output) {
        const expected = toDecimal(output.expectedQty).toNumber();
        const actual = toDecimal(output.goodQty).toNumber();
        if (expected > 0) {
          const yieldVar = ((actual - expected) / expected) * 100;
          if (Math.abs(yieldVar) > 3.0) {
            alerts.push({
              id: `var-yield-${run.id}`,
              type: 'PRODUCTION_VARIANCE',
              severity: 'HIGH',
              title: `Batch Yield Variance (${run.number})`,
              message: `Batch yield of ${actual} packets deviates by ${yieldVar.toFixed(1)}% from standard planned yield of ${expected} packets.`,
              entityId: run.id,
              createdAt: run.createdAt.toISOString(),
            });
          }
        }
      }
    }

    return alerts;
  }
}
