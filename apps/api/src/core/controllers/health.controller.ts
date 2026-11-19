import { Controller, Get, HttpStatus, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../decorators/require-permission.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PrismaReadService } from '../../prisma/prisma-read.service.js';

@Controller()
export class HealthController {
  private readonly timeoutMs: number;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PrismaReadService) private readonly prismaRead: PrismaReadService,
  ) {
    const timeoutSec = parseInt(process.env.DB_CONNECT_TIMEOUT_S || '15', 10);
    this.timeoutMs = (isNaN(timeoutSec) ? 15 : timeoutSec) * 1000;
  }

  private async pingWithTimeout(client: { $queryRaw: (query: any) => Promise<any> }): Promise<boolean> {
    try {
      const pingPromise = client.$queryRaw`SELECT 1`;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), this.timeoutMs),
      );
      await Promise.race([pingPromise, timeoutPromise]);
      return true;
    } catch {
      return false;
    }
  }

  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Public()
  @Get('health/live')
  live() {
    return this.health();
  }

  @Public()
  @Get('health/ready')
  async ready(@Res() res: Response) {
    const [primaryUp, readUp] = await Promise.all([
      this.pingWithTimeout(this.prisma),
      this.pingWithTimeout(this.prismaRead),
    ]);

    const isReady = primaryUp && readUp;
    const statusCode = isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        primaryDatabase: primaryUp ? 'up' : 'down',
        readDatabase: readUp ? 'up' : 'down',
      },
    });
  }

  @Public()
  @Get('ready')
  async rootReady(@Res() res: Response) {
    return this.ready(res);
  }
}
