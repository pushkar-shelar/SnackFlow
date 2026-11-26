import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: unknown[] | undefined;
  traceId: string;
}

@Catch()
export class Rfc7807ExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(Rfc7807ExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const traceId = (request.headers['x-request-id'] as string) || uuidv4();
    const instance = request.url;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred processing your request.';
    let errors: unknown[] | undefined = undefined;
    let type = 'https://snackflow.local/errors/internal-error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      title = exception.name.replace(/Exception$/, '');
      type = `https://snackflow.local/errors/${title.toLowerCase().replace(/\s+/g, '-')}`;

      if (typeof exceptionResponse === 'string') {
        detail = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const respObj = exceptionResponse as Record<string, any>;
        detail = respObj.message || respObj.detail || detail;
        if (Array.isArray(respObj.message)) {
          errors = respObj.message;
          detail = 'Request validation failed';
        } else if (respObj.errors) {
          errors = respObj.errors;
        }
      }
    } else if (exception instanceof Error) {
      const prismaCode = (exception as any)?.code as string | undefined;
      if (prismaCode === 'P2002') {
        status = HttpStatus.CONFLICT;
        title = 'Conflict';
        type = 'https://snackflow.local/errors/conflict';
        detail = 'A record with these unique fields already exists.';
      } else if (prismaCode === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        title = 'NotFound';
        type = 'https://snackflow.local/errors/not-found';
        detail = 'Requested record was not found.';
      } else if (
        prismaCode === 'P2003' ||
        prismaCode === 'P2023' ||
        exception.name === 'PrismaClientValidationError'
      ) {
        status = HttpStatus.BAD_REQUEST;
        title = 'BadRequest';
        type = 'https://snackflow.local/errors/bad-request';
        detail = 'Invalid identifier, query parameter, or request reference provided.';
      } else {
        this.logger.error(`Unhandled error [${traceId}]: ${exception.message}`, exception.stack);
        detail = 'An unexpected internal error occurred';
      }
    }

    const problem: ProblemDetails = {
      type,
      title,
      status,
      detail: Array.isArray(detail) ? detail.join(', ') : detail,
      instance,
      traceId,
      ...(errors ? { errors } : {}),
    };

    response.setHeader('Content-Type', 'application/problem+json');
    response.status(status).json(problem);
  }
}
