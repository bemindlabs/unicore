import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { EventEmitter } from 'events';
import { RagProxyController } from './rag-proxy.controller';
import { ProxyService } from './proxy.service';

const mockProxyService = {
  forward: jest.fn(),
};

function makeReq(opts: { body?: any; rawBody?: Buffer } = {}) {
  const emitter = new EventEmitter() as any;
  emitter.method = 'GET';
  emitter.originalUrl = '/api/proxy/rag/info';
  emitter.headers = {};
  // Default body to null (not undefined) so readBody doesn't wait for stream events
  emitter.body = 'body' in opts ? opts.body : null;
  if (opts.rawBody !== undefined) emitter.rawBody = opts.rawBody;
  return emitter;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    end: jest.fn(),
  } as any;
}

const successResponse = { statusCode: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from('{}') };

describe('RagProxyController', () => {
  let controller: RagProxyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagProxyController],
      providers: [{ provide: ProxyService, useValue: mockProxyService }],
    }).compile();

    controller = module.get<RagProxyController>(RagProxyController);
    jest.clearAllMocks();
  });

  describe('getInfo', () => {
    it('proxies to /rag/api/v1/ingest/info/default', async () => {
      const req = makeReq();
      const res = makeRes();
      mockProxyService.forward.mockResolvedValue(successResponse);

      await controller.getInfo(req, res, 'user-1');

      expect(mockProxyService.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/rag/api/v1/ingest/info/default',
          userId: 'user-1',
        }),
      );
    });
  });

  describe('ingest', () => {
    it('proxies POST to /rag/api/v1/ingest', async () => {
      const req = makeReq({ body: { text: 'Hello world', metadata: {} } });
      const res = makeRes();
      mockProxyService.forward.mockResolvedValue({ statusCode: 201, headers: {}, body: Buffer.from('{"id":"doc-1"}') });

      await controller.ingest(req, res, 'user-1');

      expect(mockProxyService.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/rag/api/v1/ingest',
          userId: 'user-1',
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('deleteDocument', () => {
    it('proxies DELETE to /rag/api/v1/ingest/:id', async () => {
      const req = makeReq();
      const res = makeRes();
      mockProxyService.forward.mockResolvedValue({ statusCode: 204, headers: {}, body: Buffer.from('') });

      await controller.deleteDocument('doc-xyz', req, res, 'user-1');

      expect(mockProxyService.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          path: '/rag/api/v1/ingest/doc-xyz',
          userId: 'user-1',
        }),
      );
    });
  });

  describe('query', () => {
    it('proxies POST to /rag/api/v1/query', async () => {
      const req = makeReq({ body: { query: 'find documents about AI' } });
      const res = makeRes();
      mockProxyService.forward.mockResolvedValue({ statusCode: 200, headers: {}, body: Buffer.from('[{"score":0.9}]') });

      await controller.query(req, res, 'user-1');

      expect(mockProxyService.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/rag/api/v1/query',
        }),
      );
    });
  });

  describe('health', () => {
    it('proxies GET to /rag/health without userId', async () => {
      const req = makeReq();
      const res = makeRes();
      mockProxyService.forward.mockResolvedValue({ statusCode: 200, headers: {}, body: Buffer.from('{"status":"ok"}') });

      await controller.health(req, res);

      expect(mockProxyService.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/rag/health',
          userId: undefined,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('throws BAD_GATEWAY on unhandled errors', async () => {
      const req = makeReq();
      const res = makeRes();
      mockProxyService.forward.mockRejectedValue(new Error('connection reset'));

      await expect(controller.getInfo(req, res, 'user-1')).rejects.toMatchObject({
        status: HttpStatus.BAD_GATEWAY,
      });
    });

    it('re-throws HttpException as-is', async () => {
      const req = makeReq();
      const res = makeRes();
      const err = new HttpException('Not found', HttpStatus.NOT_FOUND);
      mockProxyService.forward.mockRejectedValue(err);

      await expect(controller.getInfo(req, res, 'user-1')).rejects.toThrow(err);
    });

    it('sets response headers from proxy response', async () => {
      const req = makeReq();
      const res = makeRes();
      mockProxyService.forward.mockResolvedValue({
        statusCode: 200,
        headers: { 'x-rag-version': '1.0', 'content-type': 'application/json' },
        body: Buffer.from('{}'),
      });

      await controller.getInfo(req, res, 'user-1');

      expect(res.setHeader).toHaveBeenCalledWith('x-rag-version', '1.0');
      expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
    });
  });

  describe('body reading', () => {
    it('reads rawBody when present', async () => {
      const rawBody = Buffer.from('{"raw":true}');
      const req = makeReq({ rawBody });
      const res = makeRes();
      mockProxyService.forward.mockResolvedValue(successResponse);

      await controller.ingest(req, res, 'user-1');

      expect(mockProxyService.forward).toHaveBeenCalledWith(
        expect.objectContaining({ body: rawBody }),
      );
    });

    it('serializes JSON body when rawBody absent', async () => {
      const req = makeReq({ body: { text: 'hello' } });
      const res = makeRes();
      mockProxyService.forward.mockResolvedValue(successResponse);

      await controller.ingest(req, res, 'user-1');

      const forwardCall = mockProxyService.forward.mock.calls[0][0];
      expect(forwardCall.body.toString()).toBe(JSON.stringify({ text: 'hello' }));
    });
  });
});
