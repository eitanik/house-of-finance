import { planExecution, tryFillOrder } from './orders';
import { portfolioTotalIls } from './portfolio';
import type { Order, Player, PortfolioSnapshot, WorldState } from './types';
import { getWorldSeries } from './worldGen';
import { israelWallToSimMs } from './marketHours';

export const DEFAULT_SEED = 424242;
export const DEFAULT_EPOCH = '2025-11-04';

export function initialWorldState(): WorldState {
  const simMs = israelWallToSimMs(2025, 11, 4, 10, 0);
  return {
    simMs,
    initialized: true,
    seed: DEFAULT_SEED,
    epochDate: DEFAULT_EPOCH,
  };
}

export function processPendingOrders(
  world: WorldState,
  players: Record<string, Player>,
  orders: Order[],
  upToSimMs: number,
): {
  players: Record<string, Player>;
  orders: Order[];
} {
  const series = getWorldSeries(world.seed, world.epochDate);
  let playerMap = { ...players };
  let orderList = [...orders];

  const pending = orderList
    .filter((o) => o.status === 'pending')
    .sort((a, b) => a.submittedAtSimMs - b.submittedAtSimMs);

  for (const order of pending) {
    const plan = planExecution(order.symbol, order.submittedAtSimMs);
    if (plan.executeAtSimMs > upToSimMs) continue;
    const player = playerMap[order.userId];
    if (!player) continue;
    const result = tryFillOrder(order, player, series, plan);
    playerMap[order.userId] = result.player;
    orderList = orderList.map((o) => (o.id === order.id ? result.order : o));
  }

  return { players: playerMap, orders: orderList };
}

export function snapshotPlayers(
  world: WorldState,
  players: Record<string, Player>,
  atSimMs: number,
): { uid: string; snapshot: PortfolioSnapshot }[] {
  const series = getWorldSeries(world.seed, world.epochDate);
  return Object.values(players).map((p) => ({
    uid: p.uid,
    snapshot: {
      simMs: atSimMs,
      totalIls: portfolioTotalIls(p.cashIls, p.holdings, series, atSimMs, 'close'),
    },
  }));
}

export function advanceSimMinutes(
  world: WorldState,
  players: Record<string, Player>,
  orders: Order[],
  minutes: number,
): {
  world: WorldState;
  players: Record<string, Player>;
  orders: Order[];
} {
  const target = world.simMs + minutes * 60_000;
  const { players: p2, orders: o2 } = processPendingOrders(world, players, orders, target);
  return {
    world: { ...world, simMs: target },
    players: p2,
    orders: o2,
  };
}
