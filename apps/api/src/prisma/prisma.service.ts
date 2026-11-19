import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = process.env.DATABASE_URL;
    super({
      ...(url ? { datasources: { db: { url } } } : {}),
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    const maxRetries = 3;
    let delay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('PrismaService connected to primary database endpoint.');
        return;
      } catch (error) {
        this.logger.warn(
          `PrismaService connection attempt ${attempt}/${maxRetries} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        if (attempt === maxRetries) {
          throw new Error(`PrismaService failed to connect after ${maxRetries} attempts.`);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('PrismaService disconnected.');
  }
}
