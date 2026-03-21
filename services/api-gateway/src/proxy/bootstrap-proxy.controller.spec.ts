import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { EventEmitter } from 'events';
import { BootstrapProxyController } from './bootstrap-proxy.controller';
import { ProxyService } from './proxy.service';

const mockProxyService = {
  forward: jest.fn(),
};

function makeReq(originalUrl = '/api/proxy/bootstrap/setup', body: any = undefined) {
  const emitter = new EventEmitter() as any;
  emitter.method = 'POST';
  emitter.originalUrl = originalUrl;
  emitter.headers = { 'x-bootstrap-secret': 'unicore-bootstrap-secret-local' };
  emitter.body = body;
  return emitter;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    end: jest.fn(),
  } as any;
}

describe('BootstrapProxyController', () => {
  let controller: BootstrapProxyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BootstrapProxyController],
      providers: [{ provide: ProxyService, useValue: mockProxyService }],
    }).compile();

    controller = module.get<BootstrapProxyController>(BootstrapProxyController);
    jest.clearAllMocks();
  });

  it('forwards to /bootstrap/api/v1 prefix', async () => {
    const req = makeReq('/api/proxy/bootstrap/setup');
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({ statusCode: 200, headers: {}, body: Buffer.from('{}') });

    await controller.proxyBootstrap(req, res);

    expect(mockProxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/bootstrap/api/v1/setup' }),
    );
  });

  it('does NOT pass userId (public endpoint)', async () => {
    const req = makeReq('/api/proxy/bootstrap/status');
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({ statusCode: 200, headers: {}, body: Buffer.from('{}') });

    await controller.proxyBootstrap(req, res);

    const forwardCall = mockProxyService.forward.mock.calls[0][0];
    expect(forwardCall.userId).toBeUndefined();
  });

  it('passes bootstrap secret header to downstream', async () => {
    const req = makeReq('/api/proxy/bootstrap/admin');
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({ statusCode: 201, headers: {}, body: Buffer.from('{}') });

    await controller.proxyBootstrap(req, res);

    const forwardCall = mockProxyService.forward.mock.calls[0][0];
    expect(forwardCall.headers['x-bootstrap-secret']).toBe('unicore-bootstrap-secret-local');
  });

  it('sets response status from proxy response', async () => {
    const req = makeReq('/api/proxy/bootstrap/status');
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({ statusCode: 201, headers: {}, body: Buffer.from('{}') });

    await controller.proxyBootstrap(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('throws BAD_GATEWAY on proxy error', async () => {
    const req = makeReq('/api/proxy/bootstrap/setup');
    const res = makeRes();
    mockProxyService.forward.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(controller.proxyBootstrap(req, res)).rejects.toMatchObject({
      status: HttpStatus.BAD_GATEWAY,
    });
  });

  it('re-throws HttpException from proxy service', async () => {
    const req = makeReq('/api/proxy/bootstrap/setup');
    const res = makeRes();
    const err = new HttpException('Gateway timeout', HttpStatus.GATEWAY_TIMEOUT);
    mockProxyService.forward.mockRejectedValue(err);

    await expect(controller.proxyBootstrap(req, res)).rejects.toThrow(err);
  });

  it('reads rawBody when available', async () => {
    const req = makeReq('/api/proxy/bootstrap/setup');
    req.rawBody = Buffer.from('{"wizard": true}');
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({ statusCode: 200, headers: {}, body: Buffer.from('{}') });

    await controller.proxyBootstrap(req, res);

    const forwardCall = mockProxyService.forward.mock.calls[0][0];
    expect(forwardCall.body).toEqual(Buffer.from('{"wizard": true}'));
  });
});
