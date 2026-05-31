import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsService } from './channels.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * GAPS #1 — channels.send must use the CALLING tenant's channel credentials,
 * never a shared/default tenant's bot token.
 */
describe('ChannelsService tenant isolation (GAPS #1)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  let service: ChannelsService;
  let findUnique: jest.Mock;
  let fetchMock: jest.SpyInstance;

  beforeEach(async () => {
    findUnique = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        { provide: PrismaService, useValue: { settings: { findUnique } } },
      ],
    }).compile();
    service = module.get(ChannelsService);

    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 42 } }),
      text: async () => '',
    } as unknown as Response);
  });

  afterEach(() => jest.restoreAllMocks());

  it('loads the CALLING tenant Settings row by (tenantId, key=default)', async () => {
    findUnique.mockResolvedValue({
      data: { channels: { telegramBotToken: 'TOKEN_A' } },
    });

    await service.send('telegram', 'chat-1', 'hi', undefined, TENANT_A);

    expect(findUnique).toHaveBeenCalledWith({
      where: { tenantId_key: { tenantId: TENANT_A, key: 'default' } },
    });
  });

  it('sends Telegram using tenant A token, not tenant B token', async () => {
    // Whichever tenant is asked for, return its own distinct token.
    findUnique.mockImplementation(({ where }) => {
      const tid = where.tenantId_key.tenantId;
      const token = tid === TENANT_A ? 'TOKEN_A' : 'TOKEN_B';
      return Promise.resolve({ data: { channels: { telegramBotToken: token } } });
    });

    const result = await service.send('telegram', 'chat-1', 'hi', undefined, TENANT_A);

    expect(result.success).toBe(true);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/botTOKEN_A/');
    expect(calledUrl).not.toContain('TOKEN_B');
  });

  it('sends LINE using the calling tenant access token', async () => {
    findUnique.mockResolvedValue({
      data: { channels: { lineAccessToken: 'LINE_TOKEN_B' } },
    });

    const result = await service.send('line', 'user-1', 'hi', undefined, TENANT_B);

    expect(result.success).toBe(true);
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer LINE_TOKEN_B');
  });

  it('getStatus reflects the calling tenant config', async () => {
    findUnique.mockResolvedValue({
      data: { channels: { telegramBotToken: 'TOKEN_A' } },
    });

    const status = await service.getStatus(TENANT_A);
    const telegram = status.find((s) => s.channelType === 'telegram');
    const line = status.find((s) => s.channelType === 'line');

    expect(telegram?.configured).toBe(true);
    expect(line?.configured).toBe(false);
    expect(findUnique).toHaveBeenCalledWith({
      where: { tenantId_key: { tenantId: TENANT_A, key: 'default' } },
    });
  });
});
