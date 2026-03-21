import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { EventEmitter } from 'events';
import { ErpProxyController } from './erp-proxy.controller';
import { ProxyService } from './proxy.service';

const mockProxyService = {
  forward: jest.fn(),
};

function makeReq(overrides: Partial<{
  method: string;
  originalUrl: string;
  headers: Record<string, string>;
  body: any;
  rawBody: Buffer | undefined;
}> = {}) {
  const emitter = new EventEmitter() as any;
  emitter.method = overrides.method ?? 'GET';
  emitter.originalUrl = overrides.originalUrl ?? '/api/proxy/erp/contacts';
  emitter.headers = overrides.headers ?? {};
  emitter.body = overrides.body ?? undefined;
  if (overrides.rawBody !== undefined) emitter.rawBody = overrides.rawBody;
  return emitter;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    end: jest.fn(),
  } as any;
}

describe('ErpProxyController', () => {
  let controller: ErpProxyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ErpProxyController],
      providers: [{ provide: ProxyService, useValue: mockProxyService }],
    }).compile();

    controller = module.get<ErpProxyController>(ErpProxyController);
    jest.clearAllMocks();
  });

  it('forwards GET /contacts to /erp/api/v1/contacts', async () => {
    const req = makeReq({ originalUrl: '/api/proxy/erp/contacts' });
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: Buffer.from('[]'),
    });

    await controller.proxyErp(req, res, 'user-1');

    expect(mockProxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/erp/api/v1/contacts' }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalledWith(Buffer.from('[]'));
  });

  it('forwards with query string preserved', async () => {
    const req = makeReq({ originalUrl: '/api/proxy/erp/contacts?page=2&limit=10' });
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: Buffer.from('{}'),
    });

    await controller.proxyErp(req, res, 'user-1');

    expect(mockProxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/erp/api/v1/contacts?page=2&limit=10' }),
    );
  });

  it('injects userId into forward call', async () => {
    const req = makeReq({ originalUrl: '/api/proxy/erp/orders' });
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({ statusCode: 200, headers: {}, body: Buffer.from('{}') });

    await controller.proxyErp(req, res, 'user-abc');

    expect(mockProxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-abc' }),
    );
  });

  it('reads rawBody when present', async () => {
    const rawBody = Buffer.from('{"raw": true}');
    const req = makeReq({ originalUrl: '/api/proxy/erp/orders', rawBody });
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({ statusCode: 201, headers: {}, body: Buffer.from('{}') });

    await controller.proxyErp(req, res, 'user-1');

    expect(mockProxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({ body: rawBody }),
    );
  });

  it('reads JSON body when rawBody is absent', async () => {
    const req = makeReq({ originalUrl: '/api/proxy/erp/contacts', body: { name: 'Acme' } });
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({ statusCode: 200, headers: {}, body: Buffer.from('{}') });

    await controller.proxyErp(req, res, 'user-1');

    const forwardCall = mockProxyService.forward.mock.calls[0][0];
    expect(forwardCall.body.toString()).toBe(JSON.stringify({ name: 'Acme' }));
  });

  it('sets response headers from proxy response', async () => {
    const req = makeReq({ originalUrl: '/api/proxy/erp/contacts' });
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'x-custom': 'value' },
      body: Buffer.from('{}'),
    });

    await controller.proxyErp(req, res, 'user-1');

    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
    expect(res.setHeader).toHaveBeenCalledWith('x-custom', 'value');
  });

  it('throws BAD_GATEWAY on unhandled proxy error', async () => {
    const req = makeReq({ originalUrl: '/api/proxy/erp/contacts' });
    const res = makeRes();
    mockProxyService.forward.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(controller.proxyErp(req, res, 'user-1')).rejects.toThrow(HttpException);
    await expect(
      controller.proxyErp(makeReq({ originalUrl: '/api/proxy/erp/contacts' }), makeRes(), 'user-1'),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_GATEWAY });
  });

  it('re-throws HttpException as-is', async () => {
    const req = makeReq({ originalUrl: '/api/proxy/erp/contacts' });
    const res = makeRes();
    const notFound = new HttpException('Not found', HttpStatus.NOT_FOUND);
    mockProxyService.forward.mockRejectedValue(notFound);

    await expect(controller.proxyErp(req, res, 'user-1')).rejects.toThrow(notFound);
  });
});
