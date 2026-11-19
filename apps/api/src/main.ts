import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: [
        'http://localhost:3000',
        'http://localhost:4000',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:4000',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-ID'],
    },
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT') || configService.get<number>('PORT') || 4000;

  // Security Middleware
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());

  // Global API Prefix
  app.setGlobalPrefix('api/v1');

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SnackFlow Order-to-Audit API')
    .setDescription('Production-grade API for packaged snack manufacturing, inventory ledger, GST, and audit')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  logger.log(`SnackFlow API HTTP server listening on http://localhost:${port}/api/v1`);
  logger.log(`OpenAPI documentation available on http://localhost:${port}/api/docs`);
}

bootstrap();
