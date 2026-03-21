import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { EventEmitter } from 'events';
import { AiProxyController } from './ai-proxy.controller';
import { ProxyService } from './proxy.service';
import { LicenseService } from '../license/license.service';

const mockProxyService = {
  forward: jest.fn(),
};

const mockLicenseService = {
  hasFeature: jest.fn().mockResolvedValue(true),
  getLicenseStatus: jest.fn().mockResolvedValue({ tier: 'pro' }),
};

function makeReq(originalUrl = '/api/proxy/ai/llm/complete', body: any = undefined) {
  const emitter = new EventEmitter() as any;
  emitter.method = 'POST';
  emitter.originalUrl = originalUrl;
  emitter.headers = {};
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

describe('AiProxyController', () => {
  let controller: AiProxyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiProxyController],
      providers: [
        { provide: ProxyService, useValue: mockProxyService },
        { provide: LicenseService, useValue: mockLicenseService },
      ],
    }).compile();

    controller = module.get<AiProxyController>(AiProxyController);
    jest.clearAllMocks();
  });

  it('forwards AI requests with /ai/api/v1 prefix', async () => {
    const req = makeReq('/api/proxy/ai/llm/complete');
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({ statusCode: 200, headers: {}, body: Buffer.from('{}') });

    await controller.proxyAi(req, res, 'user-1');

    expect(mockProxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/ai/api/v1/llm/complete' }),
    );
  });

  it('preserves query strings in AI proxy path', async () => {
    const req = makeReq('/api/proxy/ai/llm/models?provider=openai');
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({ statusCode: 200, headers: {}, body: Buffer.from('[]') });

    await controller.proxyAi(req, res, 'user-1');

    expect(mockProxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/ai/api/v1/llm/models?provider=openai' }),
    );
  });

  it('injects userId into forward call', async () => {
    const req = makeReq('/api/proxy/ai/llm/complete');
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({ statusCode: 200, headers: {}, body: Buffer.from('{}') });

    await controller.proxyAi(req, res, 'user-xyz');

    expect(mockProxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-xyz' }),
    );
  });

  it('sets response status and headers', async () => {
    const req = makeReq('/api/proxy/ai/llm/health');
    req.method = 'GET';
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: Buffer.from('{"status":"ok"}'),
    });

    await controller.proxyAi(req, res, 'user-1');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
    expect(res.end).toHaveBeenCalledWith(Buffer.from('{"status":"ok"}'));
  });

  it('throws BAD_GATEWAY on unhandled proxy error', async () => {
    const req = makeReq('/api/proxy/ai/llm/complete');
    const res = makeRes();
    mockProxyService.forward.mockRejectedValue(new Error('connection refused'));

    await expect(controller.proxyAi(req, res, 'user-1')).rejects.toMatchObject({
      status: HttpStatus.BAD_GATEWAY,
    });
  });

  it('re-throws HttpException from proxy service', async () => {
    const req = makeReq('/api/proxy/ai/llm/complete');
    const res = makeRes();
    const err = new HttpException('Service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    mockProxyService.forward.mockRejectedValue(err);

    await expect(controller.proxyAi(req, res, 'user-1')).rejects.toThrow(err);
  });

  it('reads JSON body from req.body', async () => {
    const req = makeReq('/api/proxy/ai/llm/complete', { prompt: 'hello' });
    const res = makeRes();
    mockProxyService.forward.mockResolvedValue({ statusCode: 200, headers: {}, body: Buffer.from('{}') });

    await controller.proxyAi(req, res, 'user-1');

    const forwardCall = mockProxyService.forward.mock.calls[0][0];
    expect(forwardCall.body.toString()).toBe(JSON.stringify({ prompt: 'hello' }));
  });
});
