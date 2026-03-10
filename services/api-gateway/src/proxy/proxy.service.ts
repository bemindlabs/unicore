import {
  Injectable,
  Logger,
  BadGatewayException,
  NotFoundException,
} from '@nestjs/common';
import * as http from 'http';
import { IncomingMessage } from 'http';
import { resolveDownstreamService, DownstreamService } from './proxy.config';

export interface ProxyRequestOptions {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer | null;
  userId?: string;
}

export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: Buffer;
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  async forward(options: ProxyRequestOptions): Promise<ProxyResponse> {
    const service = resolveDownstreamService(options.path);

    if (!service) {
      throw new NotFoundException(
        `No downstream service found for path: ${options.path}`,
      );
    }

    const downstreamPath = options.path.slice(service.pathPrefix.length) || '/';

    this.logger.debug(
      `Proxying ${options.method} ${options.path} -> ${service.name} (${service.host}:${service.port}${downstreamPath})`,
    );

    return this.proxyRequest(service, downstreamPath, options);
  }

  private proxyRequest(
    service: DownstreamService,
    downstreamPath: string,
    options: ProxyRequestOptions,
  ): Promise<ProxyResponse> {
    return new Promise((resolve, reject) => {
      const originalHost = options.headers['host'] as string | undefined;
      const forwardHeaders: http.OutgoingHttpHeaders = {
        ...options.headers,
        host: `${service.host}:${service.port}`,
        'x-forwarded-proto': 'http',
        ...(originalHost ? { 'x-forwarded-host': originalHost } : {}),
      };

      if (options.userId) {
        forwardHeaders['x-user-id'] = options.userId;
      }

      delete forwardHeaders['connection'];
      delete forwardHeaders['transfer-encoding'];
      delete forwardHeaders['keep-alive'];
      delete forwardHeaders['proxy-authenticate'];
      delete forwardHeaders['proxy-authorization'];
      delete forwardHeaders['te'];
      delete forwardHeaders['trailers'];
      delete forwardHeaders['upgrade'];

      if (options.body) {
        forwardHeaders['content-length'] = String(options.body.length);
      }

      const reqOptions: http.RequestOptions = {
        hostname: service.host,
        port: service.port,
        path: downstreamPath,
        method: options.method,
        headers: forwardHeaders,
        timeout: 30_000,
      };

      const proxyReq = http.request(reqOptions, (proxyRes: IncomingMessage) => {
        const chunks: Buffer[] = [];

        proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));

        proxyRes.on('end', () => {
          const body = Buffer.concat(chunks);
          const responseHeaders: Record<string, string | string[]> = {};

          for (const [key, value] of Object.entries(proxyRes.headers)) {
            if (
              value !== undefined &&
              key !== 'transfer-encoding' &&
              key !== 'connection'
            ) {
              responseHeaders[key] = value as string | string[];
            }
          }

          resolve({
            statusCode: proxyRes.statusCode ?? 502,
            headers: responseHeaders,
            body,
          });
        });

        proxyRes.on('error', (err: Error) => {
          this.logger.error(
            `Error reading response from ${service.name}: ${err.message}`,
          );
          reject(new BadGatewayException(`Upstream read error: ${err.message}`));
        });
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        reject(
          new BadGatewayException(
            `Upstream timeout from ${service.name} after 30s`,
          ),
        );
      });

      proxyReq.on('error', (err: Error) => {
        this.logger.error(
          `Connection error to ${service.name} (${service.host}:${service.port}): ${err.message}`,
        );
        reject(
          new BadGatewayException(
            `Cannot reach upstream service '${service.name}': ${err.message}`,
          ),
        );
      });

      if (options.body) {
        proxyReq.write(options.body);
      }

      proxyReq.end();
    });
  }
}
