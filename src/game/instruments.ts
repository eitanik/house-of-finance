import type { Instrument } from './types';

/** 20 fictional instruments — 10 TASE, 10 US (names inspired by real sectors, not real tickers). */
export const INSTRUMENTS: Instrument[] = [
  { symbol: 'TA-TEVA', name: 'תeva Pharma (sim)', market: 'TASE', basePrice: 42, vol: 0.018 },
  { symbol: 'TA-BANK', name: 'Bank Leumi (sim)', market: 'TASE', basePrice: 2850, vol: 0.012 },
  { symbol: 'TA-NICE', name: 'NICE Systems (sim)', market: 'TASE', basePrice: 520, vol: 0.015 },
  { symbol: 'TA-ICL', name: 'ICL Group (sim)', market: 'TASE', basePrice: 28, vol: 0.014 },
  { symbol: 'TA-ELAL', name: 'El Al (sim)', market: 'TASE', basePrice: 5.2, vol: 0.022 },
  { symbol: 'TA-POALIM', name: 'Hapoalim (sim)', market: 'TASE', basePrice: 2100, vol: 0.011 },
  { symbol: 'TA-DISC', name: 'Discount (sim)', market: 'TASE', basePrice: 1980, vol: 0.011 },
  { symbol: 'TA-MZRA', name: 'Mizrahi Tefahot (sim)', market: 'TASE', basePrice: 185, vol: 0.013 },
  { symbol: 'TA-OPK', name: 'OPKO (sim)', market: 'TASE', basePrice: 1.8, vol: 0.025 },
  { symbol: 'TA-ETF125', name: 'TA-125 ETF (sim)', market: 'TASE', basePrice: 168, vol: 0.01 },
  { symbol: 'US-AAPL', name: 'Apple (sim)', market: 'US', basePrice: 185, vol: 0.016 },
  { symbol: 'US-MSFT', name: 'Microsoft (sim)', market: 'US', basePrice: 410, vol: 0.014 },
  { symbol: 'US-GOOGL', name: 'Alphabet (sim)', market: 'US', basePrice: 165, vol: 0.017 },
  { symbol: 'US-AMZN', name: 'Amazon (sim)', market: 'US', basePrice: 178, vol: 0.018 },
  { symbol: 'US-NVDA', name: 'NVIDIA (sim)', market: 'US', basePrice: 480, vol: 0.022 },
  { symbol: 'US-SPY', name: 'S&P 500 ETF (sim)', market: 'US', basePrice: 520, vol: 0.01 },
  { symbol: 'US-QQQ', name: 'Nasdaq 100 ETF (sim)', market: 'US', basePrice: 440, vol: 0.012 },
  { symbol: 'US-TSLA', name: 'Tesla (sim)', market: 'US', basePrice: 240, vol: 0.028 },
  { symbol: 'US-JPM', name: 'JPMorgan (sim)', market: 'US', basePrice: 195, vol: 0.013 },
  { symbol: 'US-XOM', name: 'Exxon (sim)', market: 'US', basePrice: 110, vol: 0.015 },
];

export const INSTRUMENT_BY_SYMBOL = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.symbol, i]),
) as Record<string, Instrument>;
