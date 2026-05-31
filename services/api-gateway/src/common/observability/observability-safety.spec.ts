import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from '../filters/http-exception.filter';
import { initSentry, isSentryEnabled, captureException } from './sentry';
import { StructuredLogger } from './structured-logger.service';
import { runWithRequestContext } from './request-context';

function hostFor(): { host: ArgumentsHost; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/boom' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, json, status };
}

describe('observability safety when SENTRY_DSN is unset', () => {
  const original = process.env.SENTRY_DSN;

  beforeEach(() => {
    delete process.env.SENTRY_DSN;
  });

  afterAll(() => {
    if (original === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = original;
  });

  it('initSentry is a no-op and captureException never throws', () => {
    expect(initSentry()).toBe(false);
    expect(isSentryEnabled()).toBe(false);
    expect(() => captureException(new Error('x'), { a: 1 })).not.toThrow();
  });

  it('the exception filter handles a 500 without crashing', () => {
    const filter = new HttpExceptionFilter();
    const { host, json, status } = hostFor();

    expect(() => filter.catch(new Error('kaboom'), host)).not.toThrow();
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500 }),
    );
  });

  it('the exception filter preserves HttpException status', () => {
    const filter = new HttpExceptionFilter();
    const { host, status } = hostFor();

    filter.catch(new HttpException('nope', HttpStatus.BAD_REQUEST), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('the structured logger does not crash with or without a request context', () => {
    const logger = new StructuredLogger();
    expect(() => logger.log('outside any request', 'Test')).not.toThrow();
    expect(() =>
      runWithRequestContext({ requestId: 'req-1', userId: 'u-1' }, () => {
        logger.log('inside request', 'Test');
        logger.error('boom', 'stack', 'Test');
      }),
    ).not.toThrow();
  });
});
