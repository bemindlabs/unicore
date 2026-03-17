import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  Res,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Dedicated controller for RAG service proxy routes.
 *
 * Provides explicit path mapping between the API gateway's public API and
 * the RAG service's internal endpoints:
 *
 *   GET  /api/proxy/rag/info              → GET  /ingest/info/default
 *   POST /api/proxy/rag/ingest            → POST /ingest
 *   DELETE /api/proxy/rag/documents/:id   → DELETE /ingest/:id
 *   POST /api/proxy/rag/query             → POST /query
 *   GET  /api/proxy/rag/health            → GET  /health  (public)
 *
 * These routes take precedence over the wildcard catch-all in ProxyController
 * because NestJS resolves more specific routes first.
 */
@Controller('api/proxy/rag')
export class RagProxyController {
  private readonly logger = new Logger(RagProxyController.name);

  constructor(private readonly proxyService: ProxyService) {}

  /**
   * GET /api/proxy/rag/info
   * RAG service info — collection stats for the default workspace.
   * Proxied to: GET /ingest/info/default
   */
  @Get('info')
  async getInfo(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser('id') userId: string,
  ) {
    return this.forward(req, res, 'GET', '/rag/api/v1/ingest/info/default', userId);
  }

  /**
   * POST /api/proxy/rag/ingest
   * Ingest a single document (chunk → embed → store in Qdrant).
   * Proxied to: POST /api/v1/ingest
   */
  @Post('ingest')
  async ingest(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser('id') userId: string,
  ) {
    return this.forward(req, res, 'POST', '/rag/api/v1/ingest', userId);
  }

  /**
   * DELETE /api/proxy/rag/documents/:id
   * Delete a document and all its vector chunks.
   * Proxied to: DELETE /api/v1/ingest/:id
   */
  @Delete('documents/:id')
  async deleteDocument(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser('id') userId: string,
  ) {
    return this.forward(req, res, 'DELETE', `/rag/api/v1/ingest/${id}`, userId);
  }

  /**
   * POST /api/proxy/rag/query
   * Semantic vector search — find relevant document chunks.
   * Proxied to: POST /api/v1/query
   */
  @Post('query')
  async query(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser('id') userId: string,
  ) {
    return this.forward(req, res, 'POST', '/rag/api/v1/query', userId);
  }

  /**
   * GET /api/proxy/rag/health
   * RAG service health check (Qdrant connectivity).
   * Proxied to: GET /health
   * Public — no auth required.
   */
  @Public()
  @Get('health')
  async health(@Req() req: Request, @Res() res: Response) {
    return this.forward(req, res, 'GET', '/rag/health', undefined);
  }

  private async forward(
    req: Request,
    res: Response,
    method: string,
    ragPath: string,
    userId: string | undefined,
  ): Promise<void> {
    try {
      const body = await this.readBody(req);

      const proxyResponse = await this.proxyService.forward({
        method,
        path: ragPath,
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
      this.logger.error(`Unhandled RAG proxy error for ${ragPath}:`, err);
      throw new HttpException('Internal gateway error', HttpStatus.BAD_GATEWAY);
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
