import { IsInt, IsString, IsArray, IsObject, Min } from 'class-validator';

export class SyncStatsDto {
  @IsInt()
  @Min(0)
  xp!: number;

  @IsInt()
  @Min(1)
  level!: number;

  @IsString()
  tier!: string;

  @IsInt()
  @Min(0)
  currentStreak!: number;

  @IsInt()
  @Min(0)
  longestStreak!: number;

  @IsArray()
  achievements!: string[];

  @IsObject()
  actionCounts!: Record<string, number>;

  @IsInt()
  @Min(0)
  totalPlayTimeMs!: number;
}
