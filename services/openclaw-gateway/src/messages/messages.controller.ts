import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { MessagePersistenceService, PersistedMessage } from '../persistence/message-persistence.service';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

/**
 * REST endpoint for retrieving persisted OpenClaw channel message history.
 * Used by the dashboard to load chat history on page load.
 *
 * GET /messages?channel={channel}&limit=50&before={ISO timestamp}
 */
@Controller('messages')
export class MessagesController {
  constructor(private readonly persistence: MessagePersistenceService) {}

  @Get()
  async getMessages(
    @Query('channel') channel: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ): Promise<PersistedMessage[]> {
    if (!channel) {
      throw new BadRequestException('channel query param is required');
    }

    const limitNum = Math.min(parseInt(limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, MAX_LIMIT);

    let beforeDate: Date | undefined;
    if (before) {
      beforeDate = new Date(before);
      if (isNaN(beforeDate.getTime())) {
        throw new BadRequestException('before must be a valid ISO 8601 timestamp');
      }
    }

    return this.persistence.findByChannel(channel, limitNum, beforeDate);
  }
}
