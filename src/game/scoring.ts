import { competitionWindowEndMs, competitionWindowStartMs, weekIdIsrael } from './marketHours';
import { dailyScoreBonus } from './dailyQuest';
import type { DailyQuestState, PortfolioSnapshot } from './types';

export type LeaderboardRow = {
  uid: string;
  displayName: string;
  weeklyReturn: number;
  mdd: number;
  returnPercentile: number;
  stabilityPercentile: number;
  score: number;
  dailyBonus: number;
  streak: number;
};

/**
 * 0–100 where 100 = best in cohort. Ties get the same score (average rank).
 * Previous bug: used rank/(n-1) so rank 0 (best) got 0 — inverted.
 */
function percentileRank(values: number[], higherIsBetter: boolean): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [100];
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => {
    if (a.v !== b.v) return higherIsBetter ? b.v - a.v : a.v - b.v;
    return a.i - b.i;
  });
  const out = new Array<number>(n);
  let r = 0;
  while (r < n) {
    let tieEnd = r;
    while (tieEnd + 1 < n && indexed[tieEnd + 1]!.v === indexed[r]!.v) tieEnd++;
    const avgRank = (r + tieEnd) / 2;
    const pct = ((n - 1 - avgRank) / (n - 1)) * 100;
    for (let k = r; k <= tieEnd; k++) {
      out[indexed[k]!.i] = pct;
    }
    r = tieEnd + 1;
  }
  return out;
}

export function maxDrawdown(snapshots: PortfolioSnapshot[]): number {
  if (snapshots.length === 0) return 0;
  const sorted = [...snapshots].sort((a, b) => a.simMs - b.simMs);
  let peak = sorted[0].totalIls;
  let maxDd = 0;
  for (const s of sorted) {
    if (s.totalIls > peak) peak = s.totalIls;
    const dd = peak > 0 ? (peak - s.totalIls) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

/** Last snapshot strictly before competition week; baseline for week return / MDD */
function lastSnapshotBeforeWeek(
  snapshots: PortfolioSnapshot[],
  startMs: number,
): PortfolioSnapshot | undefined {
  const sorted = [...snapshots].sort((a, b) => a.simMs - b.simMs);
  let last: PortfolioSnapshot | undefined;
  for (const s of sorted) {
    if (s.simMs < startMs) last = s;
    else break;
  }
  return last;
}

function snapshotsInCompetitionWeek(
  snapshots: PortfolioSnapshot[],
  weekId: string,
): PortfolioSnapshot[] {
  const startMs = competitionWindowStartMs(weekId);
  const endMs = competitionWindowEndMs(weekId);
  return [...snapshots]
    .filter((s) => s.simMs >= startMs && s.simMs <= endMs)
    .sort((a, b) => a.simMs - b.simMs);
}

/**
 * Weekly return: (סוף חלון מסחר שבועי − בסיס בתחילת החלון) / בסיס.
 * הבסיס הוא צילום אחרון לפני שלישי 00:00; אם אין — הצילום הראשון בתוך השבוע.
 */
export function weeklyReturn(
  snapshots: PortfolioSnapshot[],
  weekId: string,
): number {
  const startMs = competitionWindowStartMs(weekId);
  const endMs = competitionWindowEndMs(weekId);
  const inWeek = snapshotsInCompetitionWeek(snapshots, weekId);
  if (inWeek.length === 0) return 0;
  const baseline = lastSnapshotBeforeWeek(snapshots, startMs);
  const startVal = baseline?.totalIls ?? inWeek[0].totalIls;
  const endVal = inWeek[inWeek.length - 1].totalIls;
  if (startVal <= 0) return 0;
  return (endVal - startVal) / startVal;
}

/** MDD על עקומת התיק בתוך השבוע, כולל נקודת בסיס לפני השבוע אם קיימת */
export function maxDrawdownInWeek(snapshots: PortfolioSnapshot[], weekId: string): number {
  const startMs = competitionWindowStartMs(weekId);
  const inWeek = snapshotsInCompetitionWeek(snapshots, weekId);
  if (inWeek.length === 0) return 0;
  const baseline = lastSnapshotBeforeWeek(snapshots, startMs);
  const path: PortfolioSnapshot[] = baseline ? [baseline, ...inWeek] : [...inWeek];
  return maxDrawdown(path);
}

export function buildLeaderboard(
  players: {
    uid: string;
    displayName: string;
    snapshots: PortfolioSnapshot[];
    dailyQuest?: DailyQuestState;
  }[],
  simMs: number,
  nowMs = Date.now(),
): LeaderboardRow[] {
  const weekId = weekIdIsrael(simMs);

  const stats = players.map((p) => ({
    uid: p.uid,
    displayName: p.displayName,
    weeklyReturn: weeklyReturn(p.snapshots, weekId),
    mdd: maxDrawdownInWeek(p.snapshots, weekId),
  }));

  const returnPct = percentileRank(
    stats.map((s) => s.weeklyReturn),
    true,
  );
  const stabilityPct = percentileRank(
    stats.map((s) => s.mdd),
    false,
  );

  return stats
    .map((s, i) => {
      const p = players.find((x) => x.uid === s.uid);
      const dailyBonus = dailyScoreBonus(p?.dailyQuest, nowMs);
      const base = 0.85 * returnPct[i] + 0.15 * stabilityPct[i];
      return {
        ...s,
        returnPercentile: returnPct[i],
        stabilityPercentile: stabilityPct[i],
        dailyBonus,
        streak: p?.dailyQuest?.streak ?? 0,
        score: base + dailyBonus,
      };
    })
    .sort((a, b) => b.score - a.score);
}
