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
 * Dedicated proxy for the AI Engine service.
 * AI Engine uses setGlobalPrefix('api/v1'), so downstream paths need /api/v1 prepended.
 *
 * Dashboard calls:  /api/proxy/ai/llm/complete, /api/proxy/ai/llm/health, etc.
 * AI Engine expects: /api/v1/llm/complete, /api/v1/llm/health, etc.
 */
@Controller('api/proxy/ai')
export class AiProxyController {
  private readonly logger = new Logger(AiProxyController.name);

  constructor(private readonly proxyService: ProxyService) {}

  @All('*')
  async proxyAi(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser('id') userId: string,
  ) {
    const prefix = '/api/proxy/ai';
    const subPath = req.originalUrl.startsWith(prefix)
      ? req.originalUrl.slice(prefix.length) || ''
      : '';
    // AI Engine uses /api/v1 global prefix
    const downstreamPath = '/ai/api/v1' + subPath;

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
      this.logger.error(`AI proxy error: ${downstreamPath}`, err);
      throw new HttpException('AI proxy error', HttpStatus.BAD_GATEWAY);
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
