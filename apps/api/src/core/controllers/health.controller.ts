import { Controller, Get, HttpStatus, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../decorators/require-permission.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Public()
  @Get('live')
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Public()
  @Get('ready')
  async ready(@Res() res: Response) {
    let dbStatus = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }

    const isReady = dbStatus === 'up';
    const statusCode = isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus,
      },
    });
  }
}
