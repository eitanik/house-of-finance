import {
  ensureDailyState,
  markAdvanceActivity,
  markOrderActivity,
  refreshHoldingsQuest,
} from '../game/dailyQuest';
import type { Player } from '../game/types';

export function touchPlayerDaily(player: Player): Player {
  const dailyQuest = ensureDailyState(player.dailyQuest, player.uid);
  let next = refreshHoldingsQuest(dailyQuest, player.holdings);
  return { ...player, dailyQuest: next };
}

export function onPlayerOrder(
  player: Player,
  symbol: string,
  side: 'buy' | 'sell',
  amountIls: number,
): Player {
  const dq = ensureDailyState(player.dailyQuest, player.uid);
  const dailyQuest = markOrderActivity(dq, symbol, side, amountIls, player.holdings);
  return { ...player, dailyQuest };
}

export function onPlayerAdvance(player: Player, minutes: number): Player {
  const dq = ensureDailyState(player.dailyQuest, player.uid);
  const dailyQuest = markAdvanceActivity(dq, minutes, player.holdings);
  return { ...player, dailyQuest };
}
