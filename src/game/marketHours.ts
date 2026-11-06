import type { Market } from './types';
import {
  addCalendarDaysIsrael,
  formatIsraelDate,
  israelParts,
  israelWallToSimMs,
  nyParts,
  wallTimeToUtcMs,
  NY_TZ,
} from './timeUtils';

export function simMsToIsraelDate(simMs: number): Date {
  const p = israelParts(simMs);
  return new Date(israelWallToSimMs(p.year, p.month, p.day, p.hour, p.minute));
}

export { israelWallToSimMs };

function dayOfWeekIsrael(simMs: number): number {
  return israelParts(simMs).weekday;
}

export function isTradingDay(market: Market, simMs: number): boolean {
  const dow = dayOfWeekIsrael(simMs);
  if (market === 'US') {
    return dow >= 1 && dow <= 5;
  }
  return dow >= 2 && dow <= 5;
}

function minutesSinceMidnightIsrael(simMs: number): number {
  const p = israelParts(simMs);
  return p.hour * 60 + p.minute;
}

function minutesSinceMidnightNy(simMs: number): number {
  const p = nyParts(simMs);
  return p.hour * 60 + p.minute;
}

export function isMarketOpen(market: Market, simMs: number): boolean {
  if (!isTradingDay(market, simMs)) return false;
  const dow = dayOfWeekIsrael(simMs);

  if (market === 'TASE') {
    const m = minutesSinceMidnightIsrael(simMs);
    if (dow === 5) return m >= 10 * 60 && m < 13 * 60 + 50;
    return m >= 10 * 60 && m < 17 * 60 + 30;
  }

  const m = minutesSinceMidnightNy(simMs);
  return m >= 9 * 60 + 30 && m < 16 * 60;
}

export function nextTradingDayOpenMs(market: Market, simMs: number): number {
  let t = simMs + 60_000;
  for (let i = 0; i < 14; i++) {
    if (!isTradingDay(market, t)) {
      t = addCalendarDaysIsrael(t, 1);
      continue;
    }
    const p = israelParts(t);
    if (market === 'TASE') {
      return israelWallToSimMs(p.year, p.month, p.day, 10, 0);
    }
    const np = nyParts(t);
    const openMs = wallTimeToUtcMs(NY_TZ, np.year, np.month, np.day, 9, 30);
    if (openMs > simMs) return openMs;
    t = addCalendarDaysIsrael(t, 1);
  }
  return simMs + 86_400_000;
}

export function sameDayCloseMs(market: Market, simMs: number): number {
  const p = israelParts(simMs);
  if (market === 'TASE') {
    if (p.weekday === 5) return israelWallToSimMs(p.year, p.month, p.day, 13, 50);
    return israelWallToSimMs(p.year, p.month, p.day, 17, 30);
  }
  const np = nyParts(simMs);
  return wallTimeToUtcMs(NY_TZ, np.year, np.month, np.day, 16, 0);
}

export function calendarDateIsrael(simMs: number): string {
  return formatIsraelDate(simMs);
}

export function parseIsraelDate(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return israelWallToSimMs(y, m, d, 12, 0);
}

export function isCompetitionDay(simMs: number): boolean {
  const dow = dayOfWeekIsrael(simMs);
  return dow >= 2 && dow <= 5;
}

export function weekIdIsrael(simMs: number): string {
  const p = israelParts(simMs);
  const tuesdayOffset = p.weekday >= 2 ? p.weekday - 2 : p.weekday + 5;
  const tuesdayMs = addCalendarDaysIsrael(simMs, -tuesdayOffset);
  return formatIsraelDate(tuesdayMs);
}

export function competitionWindowStartMs(weekId: string): number {
  const [y, m, d] = weekId.split('-').map(Number);
  return israelWallToSimMs(y, m, d, 0, 0);
}

export function competitionWindowEndMs(weekId: string): number {
  const tuesdayMs = parseIsraelDate(weekId);
  const fridayMs = addCalendarDaysIsrael(tuesdayMs, 3);
  const p = israelParts(fridayMs);
  return israelWallToSimMs(p.year, p.month, p.day, 17, 30);
}
