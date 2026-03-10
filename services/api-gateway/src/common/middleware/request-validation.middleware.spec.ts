import { RequestValidationMiddleware } from './request-validation.middleware';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { Request, Response } from 'express';

function buildReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    url: '/erp/invoices',
    headers: {},
    ...overrides,
  } as unknown as Request;
}

describe('RequestValidationMiddleware', () => {
  let middleware: RequestValidationMiddleware;

  beforeEach(() => {
    middleware = new RequestValidationMiddleware();
  });

  it('calls next() for a valid GET request', () => {
    const next = jest.fn();
    middleware.use(buildReq(), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() for a valid POST with application/json', () => {
    const next = jest.fn();
    middleware.use(
      buildReq({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }),
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('throws BadRequestException for a disallowed HTTP method', () => {
    const next = jest.fn();
    expect(() =>
      middleware.use(buildReq({ method: 'PROPFIND' }), {} as Response, next),
    ).toThrow(BadRequestException);
    expect(next).not.toHaveBeenCalled();
  });

  it('throws PayloadTooLargeException when Content-Length exceeds the limit', () => {
    const next = jest.fn();
    const maxBytes = parseInt(process.env.MAX_REQUEST_BODY_BYTES ?? '1048576', 10);
    expect(() =>
      middleware.use(
        buildReq({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-length': String(maxBytes + 1),
          },
        }),
        {} as Response,
        next,
      ),
    ).toThrow(PayloadTooLargeException);
  });

  it('throws BadRequestException for an unsupported content-type on POST', () => {
    const next = jest.fn();
    expect(() =>
      middleware.use(
        buildReq({
          method: 'POST',
          headers: { 'content-type': 'application/xml' },
        }),
        {} as Response,
        next,
      ),
    ).toThrow(BadRequestException);
  });

  it('does not check content-type for GET requests', () => {
    const next = jest.fn();
    middleware.use(
      buildReq({
        method: 'GET',
        headers: { 'content-type': 'application/xml' },
      }),
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('accepts content-type with charset parameter', () => {
    const next = jest.fn();
    middleware.use(
      buildReq({
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
