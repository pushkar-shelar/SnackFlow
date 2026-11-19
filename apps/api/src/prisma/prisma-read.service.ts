import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaReadService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaReadService.name);

  constructor() {
    const readUrl =
      process.env.READ_REPLICA_URL ||
      process.env.READONLY_DATABASE_URL ||
      process.env.DATABASE_URL;

    super({
      ...(readUrl ? { datasources: { db: { url: readUrl } } } : {}),
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    const maxRetries = 3;
    let delay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('PrismaReadService connected to read-only database / replica endpoint.');
        return;
      } catch (error) {
        this.logger.warn(
          `PrismaReadService connection attempt ${attempt}/${maxRetries} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        if (attempt === maxRetries) {
          throw new Error(`PrismaReadService failed to connect after ${maxRetries} attempts.`);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('PrismaReadService disconnected.');
  }
}
