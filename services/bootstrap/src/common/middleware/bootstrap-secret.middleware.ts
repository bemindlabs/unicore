import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class BootstrapSecretMiddleware implements NestMiddleware {
  private readonly logger = new Logger(BootstrapSecretMiddleware.name);

  use(req: Request, _res: Response, next: NextFunction): void {
    const expected = process.env.BOOTSTRAP_SECRET;
    const provided = req.headers['x-bootstrap-secret'] as string | undefined;

    if (!expected || provided !== expected) {
      this.logger.warn(`Unauthorized bootstrap request from ${req.ip ?? 'unknown'}`);
      throw new UnauthorizedException('Invalid or missing bootstrap secret');
    }

    next();
  }
}
