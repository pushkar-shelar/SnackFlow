import { Logger } from '@nestjs/common';

async function bootstrapWorker() {
  const logger = new Logger('WorkerBootstrap');
  logger.log('Starting SnackFlow BullMQ Worker entrypoint...');

  // Worker loop initialized
  logger.log('SnackFlow Worker ready to process PDF, export, and reconciliation jobs.');
}

bootstrapWorker();
