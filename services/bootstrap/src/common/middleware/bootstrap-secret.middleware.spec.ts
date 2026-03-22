import { UnauthorizedException } from '@nestjs/common';
import { BootstrapSecretMiddleware } from './bootstrap-secret.middleware';
import type { Request, Response, NextFunction } from 'express';

const makeReq = (headers: Record<string, string> = {}): Request =>
  ({ headers, ip: '127.0.0.1' }) as unknown as Request;

const mockRes = {} as Response;
const mockNext: NextFunction = jest.fn();

describe('BootstrapSecretMiddleware', () => {
  let middleware: BootstrapSecretMiddleware;

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = new BootstrapSecretMiddleware();
    process.env.BOOTSTRAP_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.BOOTSTRAP_SECRET;
  });

  it('should be defined', () => expect(middleware).toBeDefined());

  describe('valid requests', () => {
    it('calls next() when secret header matches env var', () => {
      middleware.use(makeReq({ 'x-bootstrap-secret': 'test-secret' }), mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('does not throw when secret is correct', () => {
      expect(() =>
        middleware.use(makeReq({ 'x-bootstrap-secret': 'test-secret' }), mockRes, mockNext),
      ).not.toThrow();
    });
  });

  describe('invalid requests', () => {
    it('throws UnauthorizedException when header is missing', () => {
      expect(() => middleware.use(makeReq(), mockRes, mockNext)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when header value is wrong', () => {
      expect(() =>
        middleware.use(makeReq({ 'x-bootstrap-secret': 'wrong-secret' }), mockRes, mockNext),
      ).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when BOOTSTRAP_SECRET env var is not set', () => {
      delete process.env.BOOTSTRAP_SECRET;
      expect(() =>
        middleware.use(makeReq({ 'x-bootstrap-secret': 'any-value' }), mockRes, mockNext),
      ).toThrow(UnauthorizedException);
    });

    it('throws with "Invalid or missing bootstrap secret" message when header missing', () => {
      expect(() => middleware.use(makeReq(), mockRes, mockNext)).toThrow(
        'Invalid or missing bootstrap secret',
      );
    });

    it('throws with "Invalid or missing bootstrap secret" message when header wrong', () => {
      expect(() =>
        middleware.use(makeReq({ 'x-bootstrap-secret': 'bad' }), mockRes, mockNext),
      ).toThrow('Invalid or missing bootstrap secret');
    });

    it('does not call next() when secret is missing', () => {
      try {
        middleware.use(makeReq(), mockRes, mockNext);
      } catch {
        // expected
      }
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('does not call next() when secret is wrong', () => {
      try {
        middleware.use(makeReq({ 'x-bootstrap-secret': 'wrong' }), mockRes, mockNext);
      } catch {
        // expected
      }
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('is case-sensitive — does not match wrong casing', () => {
      expect(() =>
        middleware.use(makeReq({ 'x-bootstrap-secret': 'TEST-SECRET' }), mockRes, mockNext),
      ).toThrow(UnauthorizedException);
    });
  });
});
