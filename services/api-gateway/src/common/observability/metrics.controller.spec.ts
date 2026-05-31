import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsAccessGuard } from './metrics-access.guard';

function ctxWithHeaders(headers: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('MetricsController', () => {
  let controller: MetricsController;
  let metrics: MetricsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [MetricsService],
    }).compile();

    controller = moduleRef.get(MetricsController);
    metrics = moduleRef.get(MetricsService);
  });

  it('renders Prometheus exposition text including a known default metric', async () => {
    const res = { setHeader: jest.fn() } as unknown as Parameters<
      MetricsController['scrape']
    >[0];

    const body = await controller.scrape(res);

    expect(typeof body).toBe('string');
    // A default process metric is always present.
    expect(body).toContain('process_cpu_user_seconds_total');
    // Custom HTTP metric is registered (HELP line emitted even at zero).
    expect(body).toContain('http_request_duration_seconds');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      metrics.contentType,
    );
  });

  it('exposes the per-tenant + HTTP counters after recording', async () => {
    metrics.observeHttp('GET', '/foo', 200, 0.01);
    metrics.recordTenantCall('tenant-123');

    const res = { setHeader: jest.fn() } as unknown as Parameters<
      MetricsController['scrape']
    >[0];
    const body = await controller.scrape(res);

    expect(body).toContain('http_requests_total');
    expect(body).toContain('tenant_api_calls_total');
    expect(body).toContain('tenant-123');
  });
});

describe('MetricsAccessGuard', () => {
  const guard = new MetricsAccessGuard();

  it('allows requests carrying a whitelisted x-internal-service header', () => {
    expect(
      guard.canActivate(
        ctxWithHeaders({ 'x-internal-service': 'prometheus' }),
      ),
    ).toBe(true);
  });

  it('rejects requests without the internal header', () => {
    expect(() => guard.canActivate(ctxWithHeaders({}))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a non-whitelisted service value', () => {
    expect(() =>
      guard.canActivate(ctxWithHeaders({ 'x-internal-service': 'evil' })),
    ).toThrow(ForbiddenException);
  });
});
