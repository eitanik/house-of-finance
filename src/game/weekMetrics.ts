import { buildLeaderboard, type LeaderboardRow } from './scoring';
import type { DailyQuestState, PortfolioSnapshot } from './types';

export type WeekMetrics = {
  weeklyReturn: number;
  mdd: number;
  score: number;
  returnPercentile: number;
  stabilityPercentile: number;
  dailyBonus: number;
  streak: number;
  updatedAtSimMs: number;
};

/** Lightweight cache on player doc — rebuilt during world advance on server. */
export function computePlayerWeekMetrics(
  uid: string,
  displayName: string,
  snapshots: PortfolioSnapshot[],
  simMs: number,
  dailyQuest?: DailyQuestState,
): Omit<LeaderboardRow, 'uid' | 'displayName'> & { uid: string; displayName: string } {
  const rows = buildLeaderboard(
    [{ uid, displayName, snapshots, dailyQuest }],
    simMs,
  );
  const row = rows[0]!;
  return row;
}

export type LeaderboardCache = {
  updatedAt: number;
  simMs: number;
  rows: LeaderboardRow[];
};
