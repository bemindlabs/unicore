import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { ErpEventInterceptor } from '../src/kafka/erp-event.interceptor';
import { EventPublisherService } from '../src/kafka/event-publisher.service';
import { ERP_TOPICS } from '../src/events/event-types';

const mockPublisher = {
  publish: jest.fn().mockResolvedValue(undefined),
};

function buildContext(_metadata?: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

function buildHandler(returnValue: unknown): CallHandler {
  return {
    handle: () => of(returnValue),
  };
}

describe('ErpEventInterceptor', () => {
  let interceptor: ErpEventInterceptor;
  let reflector: Reflector;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErpEventInterceptor,
        Reflector,
        { provide: EventPublisherService, useValue: mockPublisher },
      ],
    }).compile();

    interceptor = module.get<ErpEventInterceptor>(ErpEventInterceptor);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('passes through without publishing when no @PublishEvent metadata', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    const ctx = buildContext();
    const handler = buildHandler({ orderId: 'ord-1' });

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({ complete: resolve });
    });

    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });

  it('publishes event with correct topic and keyField after handler completes', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      topic: ERP_TOPICS.ORDER_CREATED,
      keyField: 'orderId',
    });

    const returnValue = { orderId: 'ord-42', status: 'confirmed' };
    const ctx = buildContext();
    const handler = buildHandler(returnValue);

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({ complete: resolve });
    });

    // Give async tap time to resolve
    await new Promise((r) => setTimeout(r, 0));

    expect(mockPublisher.publish).toHaveBeenCalledWith(
      ERP_TOPICS.ORDER_CREATED,
      returnValue,
      'ord-42',
    );
  });

  it('does not publish when return value is null', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      topic: ERP_TOPICS.ORDER_CREATED,
      keyField: 'orderId',
    });

    const ctx = buildContext();
    const handler = buildHandler(null);

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({ complete: resolve });
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });

  it('does not rethrow when publisher fails after response', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      topic: ERP_TOPICS.INVOICE_PAID,
    });
    mockPublisher.publish.mockRejectedValueOnce(new Error('Broker down'));

    const ctx = buildContext();
    const handler = buildHandler({ invoiceId: 'inv-1' });

    // Should complete without throwing
    await expect(
      new Promise<void>((resolve, reject) => {
        interceptor.intercept(ctx, handler).subscribe({
          complete: resolve,
          error: reject,
        });
      }),
    ).resolves.toBeUndefined();
  });
});
