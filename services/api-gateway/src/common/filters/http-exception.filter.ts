import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { captureException } from '../observability/sentry';
import { getRequestContext } from '../observability/request-context';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const requestId = getRequestContext()?.requestId;

    // Log + forward unhandled / server errors. 4xx (client) errors are normal
    // request flow and are not reported to the error tracker.
    if (status >= 500) {
      this.logger.error(
        `Unhandled ${status} on ${request?.method} ${request?.url}`,
        exception instanceof Error ? exception.stack : String(exception),
        HttpExceptionFilter.name,
      );
      // Guarded by SENTRY_DSN — a no-op when Sentry is not initialized.
      captureException(exception, {
        method: request?.method,
        url: request?.url,
        requestId,
      });
    }

    response.status(status).json({
      statusCode: status,
      ...(typeof message === 'string' ? { message } : message),
      ...(requestId ? { requestId } : {}),
      timestamp: new Date().toISOString(),
    });
  }
}
