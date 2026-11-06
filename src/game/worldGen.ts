import { INSTRUMENTS } from './instruments';
import { calendarDateIsrael, isTradingDay } from './marketHours';
import { addCalendarDaysIsrael } from './timeUtils';
import { mulberry32, randn } from './rng';
import type { DayBar, FxDayBar, Instrument } from './types';

const FX_BASE = 3.65;

export type WorldSeries = {
  bySymbol: Record<string, DayBar[]>;
  fx: FxDayBar[];
  dateIndex: Record<string, number>;
};

function generateInstrumentSeries(
  inst: Instrument,
  rng: () => number,
  dates: string[],
): DayBar[] {
  let price = inst.basePrice;
  const bars: DayBar[] = [];
  for (const date of dates) {
    const dayRng = mulberry32(
      Math.imul(inst.symbol.length, 997) ^ date.split('-').join('').length,
    );
    const ret = inst.vol * randn(dayRng);
    const open = price;
    price = Math.max(0.01, price * Math.exp(ret));
    const close = Math.max(0.01, price * (1 + 0.3 * inst.vol * randn(rng)));
    bars.push({ date, open, close });
    price = close;
  }
  return bars;
}

function tradingDatesIsrael(startMs: number, count: number): string[] {
  const dates: string[] = [];
  let t = startMs;
  while (dates.length < count) {
    const d = calendarDateIsrael(t);
    if (isTradingDay('TASE', t) || isTradingDay('US', t)) {
      if (!dates.includes(d)) dates.push(d);
    }
    t = addCalendarDaysIsrael(t, 1);
  }
  return dates;
}

export function buildWorldSeries(seed: number, epochDate: string, days = 400): WorldSeries {
  const rng = mulberry32(seed);
  const [y, m, d] = epochDate.split('-').map(Number);
  const startMs = new Date(y, m - 1, d, 10, 0).getTime();
  const dates = tradingDatesIsrael(startMs, days);
  const dateIndex = Object.fromEntries(dates.map((dt, i) => [dt, i]));

  const bySymbol: Record<string, DayBar[]> = {};
  for (const inst of INSTRUMENTS) {
    bySymbol[inst.symbol] = generateInstrumentSeries(inst, rng, dates);
  }

  let fx = FX_BASE;
  const fxBars: FxDayBar[] = [];
  for (const date of dates) {
    const open = fx;
    fx = Math.max(3.0, fx * Math.exp(0.004 * randn(rng)));
    fxBars.push({ date, open, close: fx });
  }

  return { bySymbol, fx: fxBars, dateIndex };
}

let cached: { key: string; series: WorldSeries } | null = null;

export function getWorldSeries(seed: number, epochDate: string): WorldSeries {
  const key = `${seed}:${epochDate}`;
  if (cached?.key === key) return cached.series;
  const series = buildWorldSeries(seed, epochDate);
  cached = { key, series };
  return series;
}

export function barForSimDate(
  series: WorldSeries,
  symbol: string,
  date: string,
  which: 'open' | 'close',
): number | null {
  const idx = series.dateIndex[date];
  if (idx === undefined) return null;
  const bar = series.bySymbol[symbol]?.[idx];
  if (!bar) return null;
  return which === 'open' ? bar.open : bar.close;
}

export function fxForSimDate(
  series: WorldSeries,
  date: string,
  which: 'open' | 'close',
): number {
  const idx = series.dateIndex[date];
  if (idx === undefined) return FX_BASE;
  const bar = series.fx[idx];
  return which === 'open' ? bar.open : bar.close;
}
