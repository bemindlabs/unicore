import {
  Controller,
  All,
  Req,
  Res,
  Logger,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LicenseGuard } from '../license/guards/license.guard';
import { ProFeatureRequired } from '../license/decorators/pro-feature.decorator';

/**
 * Dedicated proxy for the DLC Gateway HTTP API.
 * Requires the aiDlc feature flag — connections are rejected if not licensed.
 *
 * Dashboard calls:  /api/proxy/dlc/*
 * DLC Gateway expects: /api/v1/* (uses setGlobalPrefix('api/v1'))
 */
@Controller('api/proxy/dlc')
@ProFeatureRequired('aiDlc')
@UseGuards(LicenseGuard)
export class DlcProxyController {
  private readonly logger = new Logger(DlcProxyController.name);

  constructor(private readonly proxyService: ProxyService) {}

  @All('*')
  async proxyDlc(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser('id') userId: string,
  ) {
    const prefix = '/api/proxy/dlc';
    const subPath = req.originalUrl.startsWith(prefix)
      ? req.originalUrl.slice(prefix.length) || ''
      : '';
    const downstreamPath = '/dlc/api/v1' + subPath;

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
      this.logger.error(`DLC proxy error: ${downstreamPath}`, err);
      throw new HttpException('DLC proxy error', HttpStatus.BAD_GATEWAY);
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
