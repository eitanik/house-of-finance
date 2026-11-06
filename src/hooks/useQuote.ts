import { useMemo } from 'react';

import { INSTRUMENT_BY_SYMBOL } from '../game/instruments';
import { calendarDateIsrael } from '../game/marketHours';
import type { WorldState } from '../game/types';
import { getWorldSeries } from '../game/worldGen';

export function useQuote(world: WorldState | null, symbol: string, simMs: number) {
  return useMemo(() => {
    if (!world) return null;
    const inst = INSTRUMENT_BY_SYMBOL[symbol];
    if (!inst) return null;
    const series = getWorldSeries(world.seed, world.epochDate);
    const date = calendarDateIsrael(simMs);
    const idx = series.dateIndex[date];
    if (idx === undefined) return null;
    const bar = series.bySymbol[symbol]?.[idx];
    const fxBar = series.fx[idx];
    if (!bar) return null;
    const fx = fxBar?.close ?? 3.65;
    const ils = inst.market === 'US' ? bar.close * fx : bar.close;
    const dayChange =
      bar.open > 0 ? ((bar.close - bar.open) / bar.open) * 100 : 0;
    return { close: bar.close, open: bar.open, ils, fx, dayChange, date, idx };
  }, [world, symbol, simMs]);
}

export function usePriceHistory(
  world: WorldState | null,
  symbol: string,
  simMs: number,
  days = 14,
): number[] {
  return useMemo(() => {
    if (!world) return [];
    const series = getWorldSeries(world.seed, world.epochDate);
    const date = calendarDateIsrael(simMs);
    const idx = series.dateIndex[date];
    if (idx === undefined) return [];
    const inst = INSTRUMENT_BY_SYMBOL[symbol];
    const bars = series.bySymbol[symbol] ?? [];
    const slice = bars.slice(Math.max(0, idx - days + 1), idx + 1);
    return slice.map((b, i) => {
      const fx = series.fx[Math.max(0, idx - days + 1 + i)]?.close ?? 3.65;
      return inst.market === 'US' ? b.close * fx : b.close;
    });
  }, [world, symbol, simMs, days]);
}
