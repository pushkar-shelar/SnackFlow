import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ReportsService } from './modules/reports/reports.service.js';
import { ExportService } from './modules/reports/export.service.js';
import { InventoryService } from './modules/inventory/inventory.service.js';
import { PrismaReadService } from './prisma/prisma-read.service.js';

async function bootstrapWorker() {
  console.log('🚀 Starting SnackFlow Background Worker (BullMQ)...');
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  let redisConnection: Redis;
  try {
    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        const delay = Math.min(times * 1000, 10000);
        console.warn(`[BullMQ Worker] Redis connection attempt ${times} failed, retrying in ${delay}ms...`);
        return delay;
      },
    });
  } catch {
    console.warn('[BullMQ Worker] Could not connect to Redis. Worker running in idle fallback mode.');
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  const reportsService = app.get(ReportsService);
  const exportService = app.get(ExportService);
  const inventoryService = app.get(InventoryService);

  // 1. Reports Export Queue Worker
  const exportWorker = new Worker(
    'reports-export',
    async (job: Job) => {
      console.log(`[Worker] Processing export job ${job.id}: ${job.name}`);
      const { reportType, format, params } = job.data;

      if (reportType === 'sales-register') {
        const data = await reportsService.getSalesRegister(params?.startDate, params?.endDate);
        if (format === 'csv') {
          return exportService.generateCsv(
            [
              { header: 'Invoice #', key: 'invoiceNumber' },
              { header: 'Customer', key: 'customerName' },
              { header: 'Total (₹)', key: 'grandTotal' },
            ],
            data.rows,
          );
        }
      }
      return { status: 'completed', reportType, completedAt: new Date().toISOString() };
    },
    { connection: redisConnection },
  );

  // 2. Nightly Reconciliation & Audit Queue Worker
  const _auditWorker = new Worker(
    'nightly-audit',
    async (job: Job) => {
      console.log(`[Worker] Executing scheduled stock ledger reconciliation job ${job.id}...`);
      const company = await app.get(PrismaReadService).company.findFirst();
      const companyId = job.data?.companyId || company?.id || '';
      const reconciliation = await inventoryService.reconcileStock(companyId);
      console.log(
        `[Worker] Stock reconciliation complete: ${reconciliation.discrepancyCount} discrepancies detected.`,
      );
      return reconciliation;
    },
    { connection: redisConnection },
  );

  exportWorker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully.`);
  });

  exportWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err);
  });

  console.log('✅ SnackFlow BullMQ Worker listening on queues: "reports-export", "nightly-audit"');
}

bootstrapWorker().catch((err) => {
  console.error('[BullMQ Worker] Fatal initialization error:', err);
});
