const IL_TZ = 'Asia/Jerusalem';
const NY_TZ = 'America/New_York';

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 Sun .. 6 Sat in that zone
};

function zonedParts(ms: number, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(ms))) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const wd: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: wd[map.weekday] ?? 0,
  };
}

/** Interpret wall clock in `timeZone` as UTC ms (iterative, good enough for game). */
export function wallTimeToUtcMs(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 4; i++) {
    const p = zonedParts(guess, timeZone);
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const actual = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
    guess += desired - actual;
  }
  return guess;
}

export function israelParts(ms: number): ZonedParts {
  return zonedParts(ms, IL_TZ);
}

export function nyParts(ms: number): ZonedParts {
  return zonedParts(ms, NY_TZ);
}

export function formatIsraelDateTime(ms: number): string {
  const p = israelParts(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatIsraelDate(ms: number): string {
  const p = israelParts(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function addCalendarDaysIsrael(ms: number, days: number): number {
  const p = israelParts(ms);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days, p.hour, p.minute));
  return wallTimeToUtcMs(IL_TZ, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), p.hour, p.minute);
}

export function israelWallToSimMs(y: number, m: number, d: number, hh: number, mm: number): number {
  return wallTimeToUtcMs(IL_TZ, y, m, d, hh, mm);
}

export function nyWallToSimMsFromIsraelDay(israelMs: number, hh: number, mm: number): number {
  const p = israelParts(israelMs);
  return wallTimeToUtcMs(NY_TZ, p.year, p.month, p.day, hh, mm);
}

export { IL_TZ, NY_TZ };
