import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { WebhookTenantResolver } from './webhook-tenant-resolver.service';

/**
 * GAPS #1 (residual) — the path-less Telegram webhook must NOT silently fall
 * back to the DEMO tenant. It is rejected with 410 Gone; only the per-bot path
 * `/webhooks/telegram/<botId>` can resolve a tenant.
 */
describe('TelegramWebhookController (GAPS #1 residual)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';

  let controller: TelegramWebhookController;
  let resolveTelegram: jest.Mock;
  let fetchSpy: jest.SpyInstance;

  const makeConfig = (env: Record<string, string> = {}) =>
    ({ get: jest.fn((k: string, d?: unknown) => env[k] ?? d) }) as unknown as ConfigService;

  const update = { update_id: 42, message: { message_id: 1, chat: { id: 7, type: 'private' }, date: 0, text: 'hi' } };

  beforeEach(() => {
    resolveTelegram = jest.fn();
    const resolver = {
      resolveTelegram,
      get fallbackTenantId() {
        return 'DEMO_SHOULD_NEVER_BE_USED';
      },
    } as unknown as WebhookTenantResolver;
    controller = new TelegramWebhookController(makeConfig(), resolver);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
  });

  afterEach(() => fetchSpy.mockRestore());

  it('rejects the path-less webhook with 410 Gone (never DEMO)', () => {
    expect.assertions(3);
    try {
      controller.handleUpdate(update as never);
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.GONE);
      expect(resolveTelegram).not.toHaveBeenCalled();
    }
  });

  it('rejects a per-bot webhook with 404 when no tenant owns the bot id', async () => {
    resolveTelegram.mockResolvedValue(null);
    await expect(controller.handleUpdateForBot('999', update as never)).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resolves the owning tenant from the bot id and forwards with that tenant', async () => {
    resolveTelegram.mockResolvedValue(TENANT_A);
    const res = await controller.handleUpdateForBot('987654', update as never);
    expect(res).toEqual({ ok: true });
    expect(resolveTelegram).toHaveBeenCalledWith('987654');
    // forwarded to OpenClaw with the resolved tenant, not DEMO
    const [, init] = fetchSpy.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ 'x-tenant-id': TENANT_A });
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ tenantId: TENANT_A });
  });
});
