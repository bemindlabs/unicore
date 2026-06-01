import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { runWithTenant } from '../common/tenancy/tenant-store';
import { DEMO_TENANT_ID } from '../common/tenancy/tenancy.config';

/**
 * WebhookTenantResolver (GAPS #1)
 *
 * Inbound channel webhooks (LINE / Telegram / …) arrive with NO authenticated
 * tenant — they are public endpoints hit by the channel provider. To process an
 * inbound message in the correct tenant's context (and to reply with the right
 * bot token) we must map the inbound payload's *destination channel identity*
 * back to the tenant that owns it.
 *
 * Mapping strategy — lookup-by-channel-id:
 *   Each tenant stores its channel credentials in its own Settings rows
 *   (key 'line' / 'telegram' / 'default'). We scan tenants and match the inbound
 *   destination identifier (LINE `destination` = the bot's own userId; Telegram
 *   bot id parsed from the configured token) against the stored config.
 *
 * The Tenant table is NOT RLS-scoped (it is the isolation boundary itself), so
 * we can enumerate tenants; each per-tenant Settings read is RLS-pinned via
 * runWithTenant so we never read across the boundary except through this
 * explicit, identifier-matched resolution.
 *
 * Returns the owning tenantId, or null when no tenant claims the identifier.
 */
@Injectable()
export class WebhookTenantResolver {
  private readonly logger = new Logger(WebhookTenantResolver.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the tenant that owns a LINE bot, keyed by the webhook `destination`
   * (the bot's own LINE userId, stable per channel).
   */
  async resolveLine(destination?: string): Promise<string | null> {
    if (!destination) return null;
    return this.scan(['line', 'default'], (data) => {
      const line = (data['line'] as Record<string, unknown>) ?? data;
      const channels = (data['channels'] as Record<string, unknown>) ?? {};
      const candidates = [
        line?.['destination'],
        line?.['botUserId'],
        line?.['channelId'],
        channels?.['lineDestination'],
        channels?.['lineBotUserId'],
      ];
      return candidates.some((c) => typeof c === 'string' && c === destination);
    });
  }

  /**
   * Resolve the tenant that owns a Telegram bot, keyed by the numeric bot id
   * (the integer prefix of the bot token: `<botId>:<secret>`).
   */
  async resolveTelegram(botId?: string): Promise<string | null> {
    if (!botId) return null;
    return this.scan(['telegram', 'default'], (data) => {
      const tg = (data['telegram'] as Record<string, unknown>) ?? data;
      const channels = (data['channels'] as Record<string, unknown>) ?? {};
      const token =
        (tg?.['botToken'] as string) ??
        (tg?.['telegramBotToken'] as string) ??
        (channels?.['telegramBotToken'] as string) ??
        '';
      const configuredBotId = token.includes(':') ? token.split(':')[0] : '';
      const explicitBotId =
        (tg?.['botId'] as string) ?? (channels?.['telegramBotId'] as string) ?? '';
      return configuredBotId === botId || explicitBotId === botId;
    });
  }

  /**
   * Scan every tenant's Settings (under the given keys) and return the first
   * tenant whose stored config matches the predicate.
   */
  private async scan(
    keys: string[],
    matches: (data: Record<string, unknown>) => boolean,
  ): Promise<string | null> {
    let tenants: Array<{ id: string }>;
    try {
      tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    } catch (err) {
      this.logger.error(`Tenant enumeration failed: ${(err as Error).message}`);
      return null;
    }

    for (const { id } of tenants) {
      for (const key of keys) {
        try {
          const row = await runWithTenant(id, () =>
            this.prisma.settings.findUnique({
              where: { tenantId_key: { tenantId: id, key } },
            }),
          );
          const data = (row?.data ?? {}) as Record<string, unknown>;
          if (row && matches(data)) return id;
        } catch {
          // ignore — keep scanning
        }
      }
    }
    return null;
  }

  /** The DEMO bootstrap tenant — used as a last-resort fallback by callers. */
  get fallbackTenantId(): string {
    return DEMO_TENANT_ID;
  }
}
