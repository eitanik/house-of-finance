import { storage } from '../utils/storage';

import { advanceSimMinutes, initialWorldState, snapshotPlayers } from '../game/engine';
import { validateNewOrder } from '../game/orders';
import { getWorldSeries } from '../game/worldGen';
import {
  ensureDailyState,
  markAdvanceActivity,
  markOrderActivity,
  refreshHoldingsQuest,
} from '../game/dailyQuest';
import { touchPlayerDaily } from './dailyQuestPlayer';
import type { Order, Player, PortfolioSnapshot, WorldState } from '../game/types';
import { STARTING_CASH_ILS } from '../game/types';

const STORAGE_KEY = 'hof-local-game-v1';

export type LocalGameState = {
  world: WorldState;
  players: Record<string, Player>;
  orders: Order[];
  snapshotsByUser: Record<string, PortfolioSnapshot[]>;
};

async function loadState(): Promise<LocalGameState | null> {
  const raw = await storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as LocalGameState;
}

async function saveState(state: LocalGameState): Promise<void> {
  await storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function ensureLocalGame(): Promise<LocalGameState> {
  const existing = await loadState();
  if (existing) return existing;
  const world = initialWorldState();
  const fresh: LocalGameState = {
    world,
    players: {},
    orders: [],
    snapshotsByUser: {},
  };
  await saveState(fresh);
  return fresh;
}

export async function registerLocalPlayer(uid: string, displayName: string): Promise<Player> {
  const state = await ensureLocalGame();
  if (state.players[uid]) {
    const touched = touchPlayerDaily(state.players[uid]);
    state.players[uid] = touched;
    await saveState(state);
    return touched;
  }
  const player: Player = {
    uid,
    displayName,
    cashIls: STARTING_CASH_ILS,
    holdings: {},
    createdAt: Date.now(),
  };
  player.dailyQuest = ensureDailyState(undefined, uid);
  state.players[uid] = player;
  state.snapshotsByUser[uid] = [
    {
      simMs: state.world.simMs,
      totalIls: STARTING_CASH_ILS,
    },
  ];
  await saveState(state);
  return player;
}

export async function getLocalState(): Promise<LocalGameState> {
  return ensureLocalGame();
}

export async function submitLocalOrder(
  uid: string,
  symbol: string,
  side: 'buy' | 'sell',
  amountIls: number,
): Promise<{ ok: boolean; error?: string; order?: Order }> {
  const state = await ensureLocalGame();
  const player = state.players[uid];
  if (!player) return { ok: false, error: 'שחקן לא נמצא' };
  const series = getWorldSeries(state.world.seed, state.world.epochDate);
  const err = validateNewOrder(side, amountIls, symbol, player, series, state.world.simMs);
  if (err) return { ok: false, error: err };

  const order: Order = {
    id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: uid,
    symbol,
    side,
    amountIls,
    submittedAtSimMs: state.world.simMs,
    status: 'pending',
  };
  state.orders.push(order);
  const dq = ensureDailyState(player.dailyQuest, uid);
  player.dailyQuest = markOrderActivity(dq, symbol, side, amountIls, player.holdings);
  state.players[uid] = player;
  await saveState(state);
  return { ok: true, order };
}

export async function advanceLocal(minutes: number): Promise<LocalGameState> {
  let state = await ensureLocalGame();
  const result = advanceSimMinutes(state.world, state.players, state.orders, minutes);
  state.world = result.world;
  state.players = result.players;
  state.orders = result.orders;

  const snaps = snapshotPlayers(state.world, state.players, state.world.simMs);
  for (const [id, p] of Object.entries(result.players)) {
    let dq = ensureDailyState(p.dailyQuest, id);
    dq = markAdvanceActivity(dq, minutes, p.holdings);
    dq = refreshHoldingsQuest(dq, p.holdings);
    p.dailyQuest = dq;
    result.players[id] = p;
  }

  for (const { uid, snapshot } of snaps) {
    const list = state.snapshotsByUser[uid] ?? [];
    const last = list[list.length - 1];
    if (!last || last.simMs !== snapshot.simMs) {
      list.push(snapshot);
    } else {
      list[list.length - 1] = snapshot;
    }
    state.snapshotsByUser[uid] = list;
  }

  await saveState(state);
  return state;
}

export async function resetLocalGame(): Promise<void> {
  await storage.removeItem(STORAGE_KEY);
}
