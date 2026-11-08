export type Market = 'TASE' | 'US';

export type Instrument = {
  symbol: string;
  name: string;
  market: Market;
  /** Starting price in native currency (ILS for TASE, USD for US) */
  basePrice: number;
  /** Daily volatility (approx) */
  vol: number;
};

export type DayBar = {
  date: string; // yyyy-MM-dd (calendar date in market's primary tz for storage)
  open: number;
  close: number;
};

export type FxDayBar = {
  date: string;
  open: number;
  close: number;
};

export type OrderSide = 'buy' | 'sell';

export type OrderStatus = 'pending' | 'filled' | 'rejected';

export type Order = {
  id: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  /** Amount in ILS the player wants to buy/sell (notional) */
  amountIls: number;
  submittedAtSimMs: number;
  status: OrderStatus;
  rejectReason?: string;
  filledAtSimMs?: number;
  fillPriceNative?: number;
  fillFx?: number;
  fillQty?: number;
  fillAmountIls?: number;
};

export type Holdings = Record<string, number>;

export type DailyActivity = {
  ordersSubmitted: number;
  buyIlsSubmitted: number;
  taseBuySubmitted: boolean;
  minutesAdvanced: number;
  /** Real-world app opens today (Israel date) — retention metric */
  appOpensToday: number;
};

export type DailyQuestState = {
  calendarDate: string;
  questId: string;
  completed: boolean;
  completedAt?: number;
  activity: DailyActivity;
  streak: number;
  lastCompletedDate?: string;
};

export type Player = {
  uid: string;
  displayName: string;
  cashIls: number;
  holdings: Holdings;
  createdAt: number;
  dailyQuest?: DailyQuestState;
  /** false = הסתרת תיק מאחרים (ברירת מחדל: גלוי) */
  portfolioPublic?: boolean;
};

export type PortfolioSnapshot = {
  simMs: number;
  totalIls: number;
};

export type WorldState = {
  simMs: number;
  initialized: boolean;
  seed: number;
  epochDate: string; // yyyy-MM-dd Israel — simMs=0 at Tue 10:00 this week
};

export const STARTING_CASH_ILS = 1_000_000;
export const MAX_SINGLE_ASSET_FRACTION = 0.2;
