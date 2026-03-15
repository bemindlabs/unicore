import {
  Controller,
  All,
  Req,
  Res,
  Param,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/proxy')
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);

  constructor(private readonly proxyService: ProxyService) {}

  @All('erp/*path')
  async proxyErp(
    @Req() req: Request,
    @Res() res: Response,
    @Param('path') path: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.handleProxy(req, res, `/erp/${path ?? ''}`, userId);
  }

  @All('ai/*path')
  async proxyAiEngine(
    @Req() req: Request,
    @Res() res: Response,
    @Param('path') path: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.handleProxy(req, res, `/ai/${path ?? ''}`, userId);
  }

  @All('rag/*path')
  async proxyRag(
    @Req() req: Request,
    @Res() res: Response,
    @Param('path') path: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.handleProxy(req, res, `/rag/${path ?? ''}`, userId);
  }

  @All('openclaw/*path')
  async proxyOpenclaw(
    @Req() req: Request,
    @Res() res: Response,
    @Param('path') path: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.handleProxy(req, res, `/openclaw/${path ?? ''}`, userId);
  }

  @All('bootstrap/*path')
  async proxyBootstrap(
    @Req() req: Request,
    @Res() res: Response,
    @Param('path') path: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.handleProxy(req, res, `/bootstrap/${path ?? ''}`, userId);
  }

  private async handleProxy(
    req: Request,
    res: Response,
    path: string,
    userId: string,
  ): Promise<void> {
    try {
      const body = await this.readBody(req);

      const proxyResponse = await this.proxyService.forward({
        method: req.method,
        path,
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
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Unhandled proxy error for ${path}:`, err);
      throw new HttpException('Internal gateway error', HttpStatus.BAD_GATEWAY);
    }
  }

  private readBody(req: Request): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
      if ((req as Request & { rawBody?: Buffer }).rawBody) {
        return resolve((req as Request & { rawBody?: Buffer }).rawBody!);
      }

      if (req.body !== undefined && !Buffer.isBuffer(req.body)) {
        const serialised = JSON.stringify(req.body);
        return resolve(Buffer.from(serialised, 'utf8'));
      }

      if (Buffer.isBuffer(req.body)) {
        return resolve(req.body);
      }

      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : null));
      req.on('error', reject);
    });
  }
}
