import { INSTRUMENT_BY_SYMBOL } from './instruments';
import { calendarDateIsrael } from './marketHours';
import type { Holdings } from './types';
import type { WorldSeries } from './worldGen';
import { barForSimDate, fxForSimDate } from './worldGen';

export function holdingValueIls(
  holdings: Holdings,
  series: WorldSeries,
  simMs: number,
  priceType: 'open' | 'close' = 'close',
): number {
  const date = calendarDateIsrael(simMs);
  let total = 0;
  for (const [symbol, qty] of Object.entries(holdings)) {
    if (qty <= 0) continue;
    const inst = INSTRUMENT_BY_SYMBOL[symbol];
    if (!inst) continue;
    const px = barForSimDate(series, symbol, date, priceType);
    if (px == null) continue;
    if (inst.market === 'US') {
      const fx = fxForSimDate(series, date, priceType);
      total += qty * px * fx;
    } else {
      total += qty * px;
    }
  }
  return total;
}

export function portfolioTotalIls(
  cashIls: number,
  holdings: Holdings,
  series: WorldSeries,
  simMs: number,
  priceType: 'open' | 'close' = 'close',
): number {
  return cashIls + holdingValueIls(holdings, series, simMs, priceType);
}

export function wouldExceedConcentration(
  cashIls: number,
  holdings: Holdings,
  series: WorldSeries,
  simMs: number,
  symbol: string,
  additionalIls: number,
): boolean {
  const inst = INSTRUMENT_BY_SYMBOL[symbol];
  if (!inst) return true;

  const date = calendarDateIsrael(simMs);
  const px = barForSimDate(series, symbol, date, 'close') ?? inst.basePrice;
  const fx = inst.market === 'US' ? fxForSimDate(series, date, 'close') : 1;
  const qtyAdd = additionalIls / (px * fx);

  const newHoldings = { ...holdings, [symbol]: (holdings[symbol] ?? 0) + qtyAdd };
  const newCash = cashIls - additionalIls;
  const total = portfolioTotalIls(newCash, newHoldings, series, simMs, 'close');
  if (total <= 0) return true;

  const assetVal =
    (newHoldings[symbol] ?? 0) *
    px *
    (inst.market === 'US' ? fx : 1);
  return assetVal / total > 0.2 + 1e-9;
}
