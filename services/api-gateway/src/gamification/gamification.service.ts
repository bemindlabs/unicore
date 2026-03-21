import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncStatsDto } from './dto/sync-stats.dto';

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(userId: string, stats: SyncStatsDto) {
    return this.prisma.gamification.upsert({
      where: { userId },
      update: {
        xp: stats.xp,
        level: stats.level,
        tier: stats.tier,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        achievements: stats.achievements,
        actionCounts: stats.actionCounts,
        totalPlayTimeMs: stats.totalPlayTimeMs,
        lastSyncedAt: new Date(),
      },
      create: {
        userId,
        xp: stats.xp,
        level: stats.level,
        tier: stats.tier,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        achievements: stats.achievements,
        actionCounts: stats.actionCounts,
        totalPlayTimeMs: stats.totalPlayTimeMs,
      },
    });
  }

  async getLeaderboard(limit = 10) {
    const entries = await this.prisma.gamification.findMany({
      take: limit,
      orderBy: { xp: 'desc' },
    });

    const userIds = entries.map((e) => e.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return entries.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      username: userMap.get(entry.userId) ?? 'Unknown',
      level: entry.level,
      xp: entry.xp,
      tier: entry.tier,
      currentStreak: entry.currentStreak,
      achievements: (entry.achievements as string[]).length,
    }));
  }

  async getStats(userId: string) {
    return this.prisma.gamification.findUnique({ where: { userId } });
  }
}
