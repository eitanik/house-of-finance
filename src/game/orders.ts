import { INSTRUMENT_BY_SYMBOL } from './instruments';
import {
  calendarDateIsrael,
  isMarketOpen,
  nextTradingDayOpenMs,
  sameDayCloseMs,
} from './marketHours';
import { wouldExceedConcentration } from './portfolio';
import type { Order, OrderSide, Player } from './types';
import type { WorldSeries } from './worldGen';
import { barForSimDate, fxForSimDate } from './worldGen';

export type ExecutionPlan = {
  executeAtSimMs: number;
  priceType: 'open' | 'close';
  tradingDate: string;
};

export function planExecution(symbol: string, submittedAtSimMs: number): ExecutionPlan {
  const inst = INSTRUMENT_BY_SYMBOL[symbol];
  if (!inst) throw new Error('Unknown symbol');
  const market = inst.market;
  const open = isMarketOpen(market, submittedAtSimMs);
  if (open) {
    const closeMs = sameDayCloseMs(market, submittedAtSimMs);
    return {
      executeAtSimMs: closeMs,
      priceType: 'close',
      tradingDate: calendarDateIsrael(closeMs),
    };
  }
  const openMs = nextTradingDayOpenMs(market, submittedAtSimMs);
  return {
    executeAtSimMs: openMs,
    priceType: 'open',
    tradingDate: calendarDateIsrael(openMs),
  };
}

export function tryFillOrder(
  order: Order,
  player: Player,
  series: WorldSeries,
  plan: ExecutionPlan,
): { player: Player; order: Order } {
  const inst = INSTRUMENT_BY_SYMBOL[order.symbol];
  if (!inst) {
    return {
      player,
      order: { ...order, status: 'rejected', rejectReason: 'נייר לא קיים' },
    };
  }

  const px = barForSimDate(series, order.symbol, plan.tradingDate, plan.priceType);
  if (px == null) {
    return {
      player,
      order: { ...order, status: 'rejected', rejectReason: 'אין מחיר ליום המסחר' },
    };
  }

  const fx = inst.market === 'US' ? fxForSimDate(series, plan.tradingDate, plan.priceType) : 1;

  if (order.side === 'buy') {
    if (order.amountIls <= 0 || order.amountIls > player.cashIls + 1e-6) {
      return {
        player,
        order: { ...order, status: 'rejected', rejectReason: 'יתרת מזומן לא מספיקה' },
      };
    }
    if (
      wouldExceedConcentration(
        player.cashIls,
        player.holdings,
        series,
        plan.executeAtSimMs,
        order.symbol,
        order.amountIls,
      )
    ) {
      return {
        player,
        order: {
          ...order,
          status: 'rejected',
          rejectReason: 'חריגה מ-20% מהתיק בנייר זה',
        },
      };
    }
    const qty = order.amountIls / (px * fx);
    const holdings = { ...player.holdings, [order.symbol]: (player.holdings[order.symbol] ?? 0) + qty };
    return {
      player: {
        ...player,
        cashIls: player.cashIls - order.amountIls,
        holdings,
      },
      order: {
        ...order,
        status: 'filled',
        filledAtSimMs: plan.executeAtSimMs,
        fillPriceNative: px,
        fillFx: fx,
        fillQty: qty,
        fillAmountIls: order.amountIls,
      },
    };
  }

  // sell by ILS notional
  const qtyNeeded = order.amountIls / (px * fx);
  const held = player.holdings[order.symbol] ?? 0;
  if (qtyNeeded > held + 1e-9) {
    return {
      player,
      order: {
        ...order,
        status: 'rejected',
        rejectReason: 'אין מספיק יחידות למכירה',
      },
    };
  }
  const holdings = { ...player.holdings, [order.symbol]: held - qtyNeeded };
  if (holdings[order.symbol] < 1e-12) delete holdings[order.symbol];
  return {
    player: {
      ...player,
      cashIls: player.cashIls + order.amountIls,
      holdings,
    },
    order: {
      ...order,
      status: 'filled',
      filledAtSimMs: plan.executeAtSimMs,
      fillPriceNative: px,
      fillFx: fx,
      fillQty: qtyNeeded,
      fillAmountIls: order.amountIls,
    },
  };
}

export function validateNewOrder(
  side: OrderSide,
  amountIls: number,
  symbol: string,
  player: Player,
  series: WorldSeries,
  simMs: number,
): string | null {
  if (!INSTRUMENT_BY_SYMBOL[symbol]) return 'נייר לא קיים';
  if (!(amountIls > 0)) return 'סכום חייב להיות חיובי';
  if (side === 'buy' && amountIls > player.cashIls) return 'יתרת מזומן לא מספיקה';
  if (side === 'buy') {
    if (wouldExceedConcentration(player.cashIls, player.holdings, series, simMs, symbol, amountIls)) {
      return 'קנייה תחרוג מ-20% מהתיק בנייר זה';
    }
  }
  if (side === 'sell') {
    const inst = INSTRUMENT_BY_SYMBOL[symbol];
    const date = calendarDateIsrael(simMs);
    const px = barForSimDate(series, symbol, date, 'close') ?? inst.basePrice;
    const fx = inst.market === 'US' ? fxForSimDate(series, date, 'close') : 1;
    const qty = amountIls / (px * fx);
    if (qty > (player.holdings[symbol] ?? 0)) return 'אין מספיק יחידות';
  }
  return null;
}
