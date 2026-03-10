import { Test, TestingModule } from '@nestjs/testing';
import { DomainRoutingMiddleware } from './domain-routing.middleware';
import { DomainResolverService } from './domain-resolver.service';
import { DomainCorsService } from './domain-cors.service';
import type { Request, Response } from 'express';
import type { DomainResolution } from './types/domain.types';

function makeReq(host?: string, method = 'GET', origin?: string): Partial<Request> {
  return {
    headers: {
      ...(host !== undefined ? { host } : {}),
      ...(origin !== undefined ? { origin } : {}),
    },
    method,
  } as Partial<Request>;
}

function makeRes(): {
  res: Partial<Response>;
  headers: Record<string, string>;
  statusCode: number;
  ended: boolean;
} {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let ended = false;

  const res: Partial<Response> = {
    setHeader: jest.fn((key: string, value: string) => {
      headers[key] = value;
      return res as Response;
    }),
    status: jest.fn((code: number) => {
      statusCode = code;
      return res as Response;
    }),
    end: jest.fn(() => {
      ended = true;
      return res as Response;
    }),
  };
  return { res, headers, get statusCode() { return statusCode; }, get ended() { return ended; } };
}

const makeResolution = (tenantId = 'tenant-abc'): DomainResolution => ({
  hostname: 'app.acme.com',
  tenantId,
  allowedOrigins: ['https://app.acme.com'],
  isVerified: true,
  updatedAt: new Date().toISOString(),
});

describe('DomainRoutingMiddleware', () => {
  let middleware: DomainRoutingMiddleware;
  let resolver: jest.Mocked<DomainResolverService>;

  beforeEach(async () => {
    resolver = {
      resolve: jest.fn().mockResolvedValue(null),
      isPlatformDomain: jest.fn().mockReturnValue(false),
      normalizeHostname: jest.fn((h: string) => h.split(':')[0]!.toLowerCase()),
    } as unknown as jest.Mocked<DomainResolverService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainRoutingMiddleware,
        { provide: DomainResolverService, useValue: resolver },
        DomainCorsService,
      ],
    }).compile();

    middleware = module.get<DomainRoutingMiddleware>(DomainRoutingMiddleware);
  });

  it('calls next() when no Host header is present', async () => {
    const req = makeReq(undefined) as Request;
    const { res } = makeRes();
    const next = jest.fn();

    await middleware.use(req, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('calls next() without attaching tenantId for unknown host', async () => {
    resolver.resolve.mockResolvedValue(null);
    const req = makeReq('unknown.example.com') as Request;
    const { res } = makeRes();
    const next = jest.fn();

    await middleware.use(req, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenantId).toBeUndefined();
  });

  it('attaches tenantId to request when domain resolves', async () => {
    resolver.resolve.mockResolvedValue(makeResolution('tenant-xyz'));
    const req = makeReq('app.acme.com') as Request;
    const { res } = makeRes();
    const next = jest.fn();

    await middleware.use(req, res as Response, next);

    expect(req.tenantId).toBe('tenant-xyz');
    expect(req.domainResolution).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('sets X-Tenant-Id response header on successful resolution', async () => {
    resolver.resolve.mockResolvedValue(makeResolution('tenant-hdr'));
    const req = makeReq('app.acme.com') as Request;
    const { res, headers } = makeRes();
    const next = jest.fn();

    await middleware.use(req, res as Response, next);

    expect(headers['X-Tenant-Id']).toBe('tenant-hdr');
  });

  it('sets CORS headers on every request', async () => {
    resolver.resolve.mockResolvedValue(null);
    const req = makeReq('localhost', 'GET', 'http://localhost:3000') as Request;
    const { res, headers } = makeRes();
    const next = jest.fn();

    await middleware.use(req, res as Response, next);

    expect(headers['Access-Control-Allow-Methods']).toBeDefined();
    expect(headers['Access-Control-Allow-Headers']).toBeDefined();
  });

  it('short-circuits OPTIONS preflight with 204', async () => {
    resolver.resolve.mockResolvedValue(null);
    const req = makeReq('localhost', 'OPTIONS', 'http://localhost:3000') as Request;
    const { res } = makeRes();
    const next = jest.fn();

    await middleware.use(req, res as Response, next);

    expect((res.status as jest.Mock).mock.calls[0]?.[0]).toBe(204);
    expect(res.end).toHaveBeenCalled();
  });

  it('calls next() and does not throw when resolver throws', async () => {
    resolver.resolve.mockRejectedValue(new Error('Redis timeout'));
    const req = makeReq('app.acme.com') as Request;
    const { res } = makeRes();
    const next = jest.fn();

    await expect(middleware.use(req, res as Response, next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
