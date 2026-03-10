import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  PayloadTooLargeException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const MAX_CONTENT_LENGTH =
  parseInt(process.env.MAX_REQUEST_BODY_BYTES ?? '1048576', 10);

const ALLOWED_CONTENT_TYPES = new Set([
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
]);

@Injectable()
export class RequestValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestValidationMiddleware.name);

  private static readonly ALLOWED_METHODS = new Set([
    'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS',
  ]);

  private static readonly BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

  use(req: Request, _res: Response, next: NextFunction): void {
    if (!RequestValidationMiddleware.ALLOWED_METHODS.has(req.method)) {
      this.logger.warn(`Rejected disallowed method: ${req.method} ${req.url}`);
      throw new BadRequestException(`HTTP method '${req.method}' is not allowed`);
    }

    const contentLengthHeader = req.headers['content-length'];
    if (contentLengthHeader !== undefined) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (!isNaN(contentLength) && contentLength > MAX_CONTENT_LENGTH) {
        this.logger.warn(
          `Request payload too large: ${contentLength} bytes (max ${MAX_CONTENT_LENGTH})`,
        );
        throw new PayloadTooLargeException(
          `Request body exceeds maximum allowed size of ${MAX_CONTENT_LENGTH} bytes`,
        );
      }
    }

    if (RequestValidationMiddleware.BODY_METHODS.has(req.method)) {
      const contentType = req.headers['content-type'];
      if (contentType) {
        const mediaType = contentType.split(';')[0]!.trim().toLowerCase();
        if (!ALLOWED_CONTENT_TYPES.has(mediaType)) {
          this.logger.warn(
            `Rejected unsupported content-type: ${contentType} on ${req.method} ${req.url}`,
          );
          throw new BadRequestException(`Unsupported Content-Type: '${mediaType}'`);
        }
      }
    }

    next();
  }
}
