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
      this.logger.error(`Unhandled error [${traceId}]: ${exception.message}`, exception.stack);
      detail = process.env.NODE_ENV === 'production' ? 'An unexpected internal error occurred' : exception.message;
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
