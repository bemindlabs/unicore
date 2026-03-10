import { RateLimitMiddleware } from './rate-limit.middleware';
import { RateLimitStore } from './rate-limit.store';
import { Request, Response } from 'express';

function buildReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    method: 'GET',
    url: '/erp/invoices',
    ...overrides,
  } as unknown as Request;
}

function buildRes(): jest.Mocked<
  Pick<Response, 'status' | 'setHeader' | 'json'>
> & { _status: number } {
  const res = {
    _status: 200,
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as jest.Mocked<
    Pick<Response, 'status' | 'setHeader' | 'json'>
  > & { _status: number };
}

describe('RateLimitMiddleware', () => {
  let store: RateLimitStore;
  let middleware: RateLimitMiddleware;

  beforeEach(() => {
    store = new RateLimitStore();
    middleware = new RateLimitMiddleware(store);
  });

  afterEach(() => {
    store.onModuleDestroy();
  });

  it('calls next() when limits are not exceeded', () => {
    const next = jest.fn();
    middleware.use(buildReq(), buildRes() as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets X-RateLimit-* headers on normal requests', () => {
    const res = buildRes();
    const next = jest.fn();
    middleware.use(buildReq(), res as unknown as Response, next);
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Limit',
      expect.any(String),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Remaining',
      expect.any(String),
    );
  });

  it('blocks the request and returns 429 when IP limit is exceeded', () => {
    const ipMax = parseInt(process.env.RATE_LIMIT_IP_MAX ?? '100', 10);
    const req = buildReq();
    const next = jest.fn();
    let res!: ReturnType<typeof buildRes>;

    // Exhaust the limit
    for (let i = 0; i <= ipMax; i++) {
      res = buildRes();
      middleware.use(req, res as unknown as Response, next);
    }

    // The last call should have blocked
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 429 }),
    );
  });

  it('sets per-user headers when a valid JWT Bearer token is present', () => {
    // Craft a minimal (unsigned) JWT with sub claim
    const header = Buffer.from('{"alg":"HS256"}').toString('base64url');
    const payload = Buffer.from('{"sub":"user-1"}').toString('base64url');
    const fakeToken = `${header}.${payload}.sig`;

    const req = buildReq({
      headers: { authorization: `Bearer ${fakeToken}` },
    });
    const res = buildRes();
    const next = jest.fn();

    middleware.use(req, res as unknown as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-User-Limit',
      expect.any(String),
    );
    expect(next).toHaveBeenCalled();
  });

  it('ignores malformed JWT tokens gracefully', () => {
    const req = buildReq({
      headers: { authorization: 'Bearer not.a.jwt.at.all' },
    });
    const next = jest.fn();
    expect(() =>
      middleware.use(req, buildRes() as unknown as Response, next),
    ).not.toThrow();
    expect(next).toHaveBeenCalled();
  });
});
