import { Test, TestingModule } from '@nestjs/testing';
import { ProxyService } from './proxy.service';
import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';

// ─── http module mock ─────────────────────────────────────────────────────────

const mockHttpRequest = jest.fn();

jest.mock('http', () => ({
  ...jest.requireActual<typeof import('http')>('http'),
  request: (...args: unknown[]) => mockHttpRequest(...args),
}));

// ─── helpers ──────────────────────────────────────────────────────────────────

function createFakeResponse(opts: {
  statusCode?: number;
  headers?: Record<string, string>;
} = {}) {
  const emitter = new EventEmitter() as EventEmitter & {
    statusCode: number;
    headers: Record<string, string>;
  };
  emitter.statusCode = opts.statusCode ?? 200;
  emitter.headers = opts.headers ?? { 'content-type': 'application/json' };
  return emitter;
}

function createFakeRequest() {
  const emitter = new EventEmitter() as EventEmitter & {
    write: jest.Mock;
    end: jest.Mock;
    destroy: jest.Mock;
  };
  emitter.write = jest.fn();
  emitter.end = jest.fn();
  emitter.destroy = jest.fn();
  return emitter;
}

/** Set up a happy-path mock: calls cb with fakeRes then emits data + end */
function setupSuccessfulProxy(body = '{}') {
  const fakeRes = createFakeResponse();
  const fakeReq = createFakeRequest();

  mockHttpRequest.mockImplementation((_opts: unknown, cb: unknown) => {
    process.nextTick(() => {
      (cb as (res: typeof fakeRes) => void)(fakeRes);
      process.nextTick(() => {
        fakeRes.emit('data', Buffer.from(body));
        fakeRes.emit('end');
      });
    });
    return fakeReq;
  });

  return { fakeRes, fakeReq };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProxyService', () => {
  let service: ProxyService;

  beforeEach(async () => {
    mockHttpRequest.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProxyService],
    }).compile();

    service = module.get<ProxyService>(ProxyService);
  });

  describe('forward', () => {
    it('throws NotFoundException when no service matches the path', async () => {
      await expect(
        service.forward({
          method: 'GET',
          path: '/unknown/resource',
          headers: {},
          body: null,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for path that only partially matches prefix', async () => {
      await expect(
        service.forward({
          method: 'GET',
          path: '/erp-extra/resource',
          headers: {},
          body: null,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('proxies successfully for /erp/* path', async () => {
      setupSuccessfulProxy(JSON.stringify({ ok: true }));

      const result = await service.forward({
        method: 'GET',
        path: '/erp/invoices',
        headers: { host: 'localhost:4000' },
        body: null,
      });

      expect(result.statusCode).toBe(200);
      expect(result.body.toString()).toBe(JSON.stringify({ ok: true }));
    });

    it('throws BadGatewayException on connection error', async () => {
      const fakeReq = createFakeRequest();

      mockHttpRequest.mockImplementation(() => {
        process.nextTick(() => {
          fakeReq.emit('error', new Error('ECONNREFUSED'));
        });
        return fakeReq;
      });

      await expect(
        service.forward({
          method: 'GET',
          path: '/erp/invoices',
          headers: {},
          body: null,
        }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('injects x-user-id header when userId is provided', async () => {
      let capturedOptions: Record<string, unknown> | null = null;

      const fakeRes = createFakeResponse();
      const fakeReq = createFakeRequest();

      mockHttpRequest.mockImplementation((opts: unknown, cb: unknown) => {
        capturedOptions = opts as Record<string, unknown>;
        process.nextTick(() => {
          (cb as (res: typeof fakeRes) => void)(fakeRes);
          process.nextTick(() => {
            fakeRes.emit('data', Buffer.from('{}'));
            fakeRes.emit('end');
          });
        });
        return fakeReq;
      });

      await service.forward({
        method: 'GET',
        path: '/ai/chat',
        headers: {},
        body: null,
        userId: 'user-abc-123',
      });

      const headers = capturedOptions?.['headers'] as Record<string, string> | undefined;
      expect(headers?.['x-user-id']).toBe('user-abc-123');
    });

    it('routes /ai/* to port 4200', async () => {
      let capturedPort: number | null = null;
      const fakeRes = createFakeResponse();
      const fakeReq = createFakeRequest();

      mockHttpRequest.mockImplementation((opts: unknown, cb: unknown) => {
        capturedPort = (opts as { port: number }).port;
        process.nextTick(() => {
          (cb as (res: typeof fakeRes) => void)(fakeRes);
          process.nextTick(() => {
            fakeRes.emit('data', Buffer.from('{}'));
            fakeRes.emit('end');
          });
        });
        return fakeReq;
      });

      await service.forward({
        method: 'POST',
        path: '/ai/generate',
        headers: {},
        body: Buffer.from('{}'),
      });

      expect(capturedPort).toBe(4200);
    });

    it('routes /rag/* to port 4300', async () => {
      let capturedPort: number | null = null;
      const fakeRes = createFakeResponse();
      const fakeReq = createFakeRequest();

      mockHttpRequest.mockImplementation((opts: unknown, cb: unknown) => {
        capturedPort = (opts as { port: number }).port;
        process.nextTick(() => {
          (cb as (res: typeof fakeRes) => void)(fakeRes);
          process.nextTick(() => {
            fakeRes.emit('data', Buffer.from('{}'));
            fakeRes.emit('end');
          });
        });
        return fakeReq;
      });

      await service.forward({
        method: 'GET',
        path: '/rag/query',
        headers: {},
        body: null,
      });

      expect(capturedPort).toBe(4300);
    });

    it('routes /bootstrap/* to port 4500', async () => {
      let capturedPort: number | null = null;
      const fakeRes = createFakeResponse();
      const fakeReq = createFakeRequest();

      mockHttpRequest.mockImplementation((opts: unknown, cb: unknown) => {
        capturedPort = (opts as { port: number }).port;
        process.nextTick(() => {
          (cb as (res: typeof fakeRes) => void)(fakeRes);
          process.nextTick(() => {
            fakeRes.emit('data', Buffer.from('{}'));
            fakeRes.emit('end');
          });
        });
        return fakeReq;
      });

      await service.forward({
        method: 'POST',
        path: '/bootstrap/setup',
        headers: {},
        body: null,
      });

      expect(capturedPort).toBe(4500);
    });

    it('strips the service prefix from the downstream path', async () => {
      let capturedPath: string | null = null;
      const fakeRes = createFakeResponse();
      const fakeReq = createFakeRequest();

      mockHttpRequest.mockImplementation((opts: unknown, cb: unknown) => {
        capturedPath = (opts as { path: string }).path;
        process.nextTick(() => {
          (cb as (res: typeof fakeRes) => void)(fakeRes);
          process.nextTick(() => {
            fakeRes.emit('data', Buffer.from('{}'));
            fakeRes.emit('end');
          });
        });
        return fakeReq;
      });

      await service.forward({
        method: 'GET',
        path: '/erp/invoices/123',
        headers: {},
        body: null,
      });

      expect(capturedPath).toBe('/invoices/123');
    });
  });
});
