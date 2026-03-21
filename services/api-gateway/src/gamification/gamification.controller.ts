import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { SyncStatsDto } from './dto/sync-stats.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/v1/gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  /**
   * POST /api/v1/gamification/sync
   * Sync local game stats from the Geek CLI to the platform database.
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async sync(@CurrentUser() user: any, @Body() dto: SyncStatsDto) {
    const record = await this.gamificationService.sync(user.id, dto);
    return { ok: true, xp: record.xp, level: record.level, lastSyncedAt: record.lastSyncedAt };
  }

  /**
   * GET /api/v1/gamification/me
   * Get the current user's synced game stats.
   */
  @Get('me')
  async me(@CurrentUser() user: any) {
    const stats = await this.gamificationService.getStats(user.id);
    if (!stats) {
      return { userId: user.id, xp: 0, level: 1, tier: 'Intern', currentStreak: 0, longestStreak: 0, achievements: [], actionCounts: {}, totalPlayTimeMs: 0 };
    }
    return stats;
  }

  /**
   * GET /api/v1/gamification/leaderboard
   * Cross-instance leaderboard based on synced XP data.
   */
  @Get('leaderboard')
  async leaderboard(@Query('limit') limit?: string) {
    return this.gamificationService.getLeaderboard(limit ? parseInt(limit, 10) : 10);
  }
}
