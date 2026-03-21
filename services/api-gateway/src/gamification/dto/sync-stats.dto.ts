export class SyncStatsDto {
  xp!: number;
  level!: number;
  tier!: string;
  currentStreak!: number;
  longestStreak!: number;
  achievements!: string[];
  actionCounts!: Record<string, number>;
  totalPlayTimeMs!: number;
}
