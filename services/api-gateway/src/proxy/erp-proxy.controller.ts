import {
  Controller,
  All,
  Req,
  Res,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Dedicated proxy for the ERP service.
 * ERP uses setGlobalPrefix('api/v1'), so all downstream paths need /api/v1 prepended.
 *
 * Dashboard calls:  /api/proxy/erp/contacts, /api/proxy/erp/inventory, etc.
 * ERP expects:      /api/v1/contacts, /api/v1/inventory, etc.
 */
@Controller('api/proxy/erp')
export class ErpProxyController {
  private readonly logger = new Logger(ErpProxyController.name);

  constructor(private readonly proxyService: ProxyService) {}

  @All('*')
  async proxyErp(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser('id') userId: string,
  ) {
    const prefix = '/api/proxy/erp';
    const subPath = req.originalUrl.startsWith(prefix)
      ? req.originalUrl.slice(prefix.length) || ''
      : '';
    // ERP service uses /api/v1 global prefix
    const downstreamPath = '/erp/api/v1' + subPath;

    try {
      const body = await this.readBody(req);
      const proxyResponse = await this.proxyService.forward({
        method: req.method,
        path: downstreamPath,
        headers: req.headers as Record<string, string | string[] | undefined>,
        body,
        userId,
      });

      res.status(proxyResponse.statusCode);
      for (const [key, value] of Object.entries(proxyResponse.headers)) {
        res.setHeader(key, value as string | string[]);
      }
      res.end(proxyResponse.body);
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`ERP proxy error: ${downstreamPath}`, err);
      throw new HttpException('ERP proxy error', HttpStatus.BAD_GATEWAY);
    }
  }

  private readBody(req: Request): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
      if ((req as Request & { rawBody?: Buffer }).rawBody) {
        return resolve((req as Request & { rawBody?: Buffer }).rawBody!);
      }
      if (req.body !== undefined && !Buffer.isBuffer(req.body)) {
        return resolve(Buffer.from(JSON.stringify(req.body), 'utf8'));
      }
      if (Buffer.isBuffer(req.body)) return resolve(req.body);
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : null));
      req.on('error', reject);
    });
  }
}
