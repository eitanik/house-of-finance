import { INSTRUMENT_BY_SYMBOL } from './instruments';
import type { DailyActivity, DailyQuestState, Holdings } from './types';
import { formatIsraelDate } from './timeUtils';

export type QuestDef = {
  id: string;
  title: string;
  description: string;
  target: number;
  kind:
    | 'orders_count'
    | 'buy_ils'
    | 'advance_minutes'
    | 'holdings_count'
    | 'tase_buy';
};

export const QUEST_POOL: QuestDef[] = [
  {
    id: 'first_trade',
    title: 'חזרה לשוק',
    description: 'שלחו לפחות פקודת מסחר אחת היום',
    target: 1,
    kind: 'orders_count',
  },
  {
    id: 'buy_power',
    title: 'כוח קנייה',
    description: 'שלחו פקודות קנייה בשווי ₪50,000 (סה״כ) היום',
    target: 50_000,
    kind: 'buy_ils',
  },
  {
    id: 'time_travel',
    title: 'קדימה בזמן',
    description: 'קדמו את שעון העולם ב-60 דקות לפחות היום',
    target: 60,
    kind: 'advance_minutes',
  },
  {
    id: 'diversify',
    title: 'פיזור',
    description: 'החזיקו לפחות 3 ניירות שונים בתיק',
    target: 3,
    kind: 'holdings_count',
  },
  {
    id: 'tel_aviv',
    title: 'ריח ת״א',
    description: 'שלחו פקודת קנייה בנייר ת״א היום',
    target: 1,
    kind: 'tase_buy',
  },
  {
    id: 'active',
    title: 'יום עמוס',
    description: 'שלחו 2 פקודות מסחר היום',
    target: 2,
    kind: 'orders_count',
  },
];

export function todayIsraelDate(nowMs = Date.now()): string {
  return formatIsraelDate(nowMs);
}

function hashPick(seed: string, size: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % size;
}

export function pickQuest(calendarDate: string, uid: string): QuestDef {
  const idx = hashPick(`${calendarDate}:${uid}`, QUEST_POOL.length);
  return QUEST_POOL[idx]!;
}

export function emptyActivity(): DailyActivity {
  return {
    ordersSubmitted: 0,
    buyIlsSubmitted: 0,
    taseBuySubmitted: false,
    minutesAdvanced: 0,
    appOpensToday: 0,
  };
}

export function initDailyState(uid: string, nowMs = Date.now()): DailyQuestState {
  const calendarDate = todayIsraelDate(nowMs);
  const quest = pickQuest(calendarDate, uid);
  return {
    calendarDate,
    questId: quest.id,
    completed: false,
    activity: emptyActivity(),
    streak: 0,
  };
}

/** Rotate quest at new Israel day; preserve streak metadata. */
export function ensureDailyState(
  current: DailyQuestState | undefined,
  uid: string,
  nowMs = Date.now(),
): DailyQuestState {
  const today = todayIsraelDate(nowMs);
  if (!current || current.calendarDate !== today) {
    const next = initDailyState(uid, nowMs);
    next.streak = current?.streak ?? 0;
    /* Firestore rejects explicit undefined — only copy when defined */
    if (current?.lastCompletedDate != null) {
      next.lastCompletedDate = current.lastCompletedDate;
    }
    next.activity.appOpensToday = 1;
    return next;
  }
  return {
    ...current,
    activity: {
      ...current.activity,
      appOpensToday: current.activity.appOpensToday + 1,
    },
  };
}

function yesterdayIsrael(today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function questDefById(id: string): QuestDef {
  return QUEST_POOL.find((q) => q.id === id) ?? QUEST_POOL[0]!;
}

export function questProgress(
  quest: QuestDef,
  activity: DailyActivity,
  holdings: Holdings,
): { current: number; target: number; ratio: number; done: boolean } {
  let current = 0;
  switch (quest.kind) {
    case 'orders_count':
      current = activity.ordersSubmitted;
      break;
    case 'buy_ils':
      current = activity.buyIlsSubmitted;
      break;
    case 'advance_minutes':
      current = activity.minutesAdvanced;
      break;
    case 'holdings_count':
      current = Object.values(holdings).filter((q) => q > 1e-8).length;
      break;
    case 'tase_buy':
      current = activity.taseBuySubmitted ? 1 : 0;
      break;
  }
  const target = quest.target;
  const ratio = Math.min(1, target > 0 ? current / target : 0);
  const done = current >= target;
  return { current, target, ratio, done };
}

export function markOrderActivity(
  state: DailyQuestState,
  symbol: string,
  side: 'buy' | 'sell',
  amountIls: number,
  holdings: Holdings,
): DailyQuestState {
  const inst = INSTRUMENT_BY_SYMBOL[symbol];
  const activity: DailyActivity = {
    ...state.activity,
    ordersSubmitted: state.activity.ordersSubmitted + 1,
    buyIlsSubmitted:
      side === 'buy' ? state.activity.buyIlsSubmitted + amountIls : state.activity.buyIlsSubmitted,
    taseBuySubmitted:
      state.activity.taseBuySubmitted || (side === 'buy' && inst?.market === 'TASE'),
  };
  return tryComplete({ ...state, activity }, holdings);
}

export function markAdvanceActivity(
  state: DailyQuestState,
  minutes: number,
  holdings: Holdings,
): DailyQuestState {
  const activity: DailyActivity = {
    ...state.activity,
    minutesAdvanced: state.activity.minutesAdvanced + minutes,
  };
  return tryComplete({ ...state, activity }, holdings);
}

export function refreshHoldingsQuest(state: DailyQuestState, holdings: Holdings): DailyQuestState {
  return tryComplete(state, holdings);
}

export function tryComplete(
  state: DailyQuestState,
  holdings: Holdings = {},
  nowMs = Date.now(),
): DailyQuestState {
  if (state.completed) return state;
  const quest = questDefById(state.questId);
  const { done } = questProgress(quest, state.activity, holdings);
  if (!done) return state;

  const today = todayIsraelDate(nowMs);
  const yest = yesterdayIsrael(today);
  let streak = 1;
  if (state.lastCompletedDate === yest) streak = state.streak + 1;
  else if (state.lastCompletedDate === today) streak = state.streak;

  return {
    ...state,
    completed: true,
    completedAt: nowMs,
    streak,
    lastCompletedDate: today,
  };
}

/** Bonus points on weekly leaderboard when today's quest is done. */
export function dailyScoreBonus(state: DailyQuestState | undefined, nowMs = Date.now()): number {
  if (!state?.completed) return 0;
  const today = todayIsraelDate(nowMs);
  if (state.calendarDate !== today) return 0;
  return Math.min(state.streak, 7) * 0.75;
}
