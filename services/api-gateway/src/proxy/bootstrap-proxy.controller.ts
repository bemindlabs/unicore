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
import { Public } from '../auth/decorators/public.decorator';
import { ProxyService } from './proxy.service';

/**
 * Public proxy for the Bootstrap service.
 * The wizard runs before any user exists, so JWT auth is not available.
 * The bootstrap service enforces its own auth via X-Bootstrap-Secret.
 */
@Controller('api/proxy/bootstrap')
export class BootstrapProxyController {
  private readonly logger = new Logger(BootstrapProxyController.name);

  constructor(private readonly proxyService: ProxyService) {}

  @Public()
  @All('*')
  async proxyBootstrap(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const prefix = '/api/proxy/bootstrap';
    const subPath = req.originalUrl.startsWith(prefix)
      ? req.originalUrl.slice(prefix.length) || ''
      : '';
    const downstreamPath = '/bootstrap/api/v1' + subPath;

    try {
      const body = await this.readBody(req);

      const proxyResponse = await this.proxyService.forward({
        method: req.method,
        path: downstreamPath,
        headers: req.headers as Record<string, string | string[] | undefined>,
        body,
      });

      res.status(proxyResponse.statusCode);
      for (const [key, value] of Object.entries(proxyResponse.headers)) {
        res.setHeader(key, value as string | string[]);
      }
      res.end(proxyResponse.body);
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Bootstrap proxy error: ${downstreamPath}`, err);
      throw new HttpException('Bootstrap proxy error', HttpStatus.BAD_GATEWAY);
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
