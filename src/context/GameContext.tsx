import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { isFirebaseConfigured } from '../firebase/config';
import type { DailyQuestState, Order, Player, PortfolioSnapshot, WorldState } from '../game/types';
import { buildLeaderboard, type LeaderboardRow } from '../game/scoring';
import { portfolioTotalIls } from '../game/portfolio';
import { getWorldSeries } from '../game/worldGen';
import { formatIsraelDateTime } from '../game/timeUtils';
import { useCloudApi } from '../services/cloudApi';
import {
  advanceLocal,
  ensureLocalGame,
  getLocalState,
  registerLocalPlayer,
  submitLocalOrder,
} from '../services/localGameStore';
import {
  advanceWorldFs,
  fetchSnapshots,
  initWorldIfNeeded,
  subscribeAllPlayers,
  subscribeLeaderboard,
  subscribeOrdersForUser,
  subscribePlayer,
  subscribeWorld,
  submitOrderFs,
  upsertPlayer,
} from '../services/firestoreGame';

type GameContextValue = {
  mode: 'firebase' | 'local';
  /** Firebase sync / callable errors (shown in dev; avoid hard crash) */
  firebaseError: string | null;
  world: WorldState | null;
  player: Player | null;
  players: Player[];
  orders: Order[];
  snapshotsByUser: Record<string, PortfolioSnapshot[]>;
  leaderboard: LeaderboardRow[];
  portfolioTotal: number;
  clockLabel: string;
  dailyQuest: DailyQuestState | undefined;
  register: (displayName: string) => Promise<void>;
  submitOrder: (symbol: string, side: 'buy' | 'sell', amountIls: number) => Promise<string | null>;
  advance: (minutes: number) => Promise<string | null>;
  refresh: () => Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);

function uidFromName(name: string): string {
  return `local_${name.trim().toLowerCase().replace(/\s+/g, '_')}`;
}

export function GameProvider({
  children,
  uid,
  displayName,
}: {
  children: React.ReactNode;
  uid: string | null;
  displayName: string | null;
}) {
  const mode = isFirebaseConfigured() ? 'firebase' : 'local';
  const cloud = useCloudApi();
  const [world, setWorld] = useState<WorldState | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [snapshotsByUser, setSnapshotsByUser] = useState<Record<string, PortfolioSnapshot[]>>({});
  const [cachedLeaderboard, setCachedLeaderboard] = useState<LeaderboardRow[]>([]);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  const loadLocal = useCallback(async () => {
    const state = await getLocalState();
    setWorld(state.world);
    setPlayers(Object.values(state.players));
    if (uid) setPlayer(state.players[uid] ?? null);
    setOrders(state.orders.filter((o) => (uid ? o.userId === uid : true)));
    setSnapshotsByUser(state.snapshotsByUser);
  }, [uid]);

  useEffect(() => {
    if (mode === 'local') {
      void ensureLocalGame().then(() => loadLocal());
      return;
    }
    void initWorldIfNeeded();
    setFirebaseError(null);
    const unsubs: (() => void)[] = [];
    const setErr = (msg: string) => setFirebaseError((prev) => prev ?? msg);
    unsubs.push(subscribeWorld(setWorld, setErr));

    if (cloud) {
      unsubs.push(
        subscribeLeaderboard((cache) => {
          setCachedLeaderboard(cache?.rows ?? []);
        }, setErr),
      );
    } else {
      unsubs.push(
        subscribeAllPlayers(async (ps) => {
          setPlayers(ps);
          const snaps: Record<string, PortfolioSnapshot[]> = {};
          await Promise.all(
            ps.map(async (p) => {
              snaps[p.uid] = await fetchSnapshots(p.uid);
            }),
          );
          setSnapshotsByUser(snaps);
        }, setErr),
      );
    }

    if (uid) {
      unsubs.push(subscribePlayer(uid, setPlayer, setErr));
      unsubs.push(subscribeOrdersForUser(uid, setOrders, setErr));
    }
    return () => unsubs.forEach((u) => u());
  }, [mode, uid, loadLocal, cloud]);

  useEffect(() => {
    if (mode === 'local' && uid && displayName) {
      void registerLocalPlayer(uid, displayName).then(() => loadLocal());
    }
    if (mode === 'firebase' && uid && displayName) {
      void upsertPlayer(uid, displayName).catch((e) => {
        const m = e instanceof Error ? e.message : String(e);
        setFirebaseError((prev) => prev ?? m);
        if (__DEV__) console.warn('[Game] upsertPlayer:', m);
      });
    }
  }, [mode, uid, displayName, loadLocal]);

  const portfolioTotal = useMemo(() => {
    if (!world || !player) return 0;
    const series = getWorldSeries(world.seed, world.epochDate);
    return portfolioTotalIls(player.cashIls, player.holdings, series, world.simMs, 'close');
  }, [world, player]);

  const clockLabel = useMemo(() => {
    if (!world) return '—';
    return formatIsraelDateTime(world.simMs) + ' (ישראל)';
  }, [world]);

  const leaderboard = useMemo(() => {
    if (mode === 'firebase' && cloud) return cachedLeaderboard;
    if (!world) return [];
    return buildLeaderboard(
      players.map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        snapshots: snapshotsByUser[p.uid] ?? [],
        dailyQuest: p.dailyQuest,
      })),
      world.simMs,
    );
  }, [mode, cloud, cachedLeaderboard, players, snapshotsByUser, world]);

  const dailyQuest = player?.dailyQuest;

  const register = useCallback(
    async (name: string) => {
      const id = mode === 'local' ? uidFromName(name) : uid!;
      if (mode === 'local') {
        await registerLocalPlayer(id, name);
        await loadLocal();
      } else {
        try {
          await upsertPlayer(id, name);
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          setFirebaseError(m);
          throw e;
        }
      }
    },
    [mode, uid, loadLocal],
  );

  const submitOrder = useCallback(
    async (symbol: string, side: 'buy' | 'sell', amountIls: number) => {
      if (!uid) return 'לא מחובר';
      if (mode === 'local') {
        const res = await submitLocalOrder(uid, symbol, side, amountIls);
        await loadLocal();
        return res.ok ? null : res.error ?? 'שגיאה';
      }
      const res = await submitOrderFs(uid, symbol, side, amountIls);
      return res.ok ? null : res.error ?? 'שגיאה';
    },
    [mode, uid, loadLocal],
  );

  const advance = useCallback(
    async (minutes: number) => {
      if (mode === 'local') {
        await advanceLocal(minutes);
        await loadLocal();
        return null;
      }
      const res = await advanceWorldFs(minutes);
      return res.ok ? null : res.error ?? 'שגיאה';
    },
    [mode, loadLocal],
  );

  const refresh = useCallback(async () => {
    if (mode === 'local') await loadLocal();
  }, [mode, loadLocal]);

  const value: GameContextValue = {
    mode,
    firebaseError,
    world,
    player,
    players,
    orders,
    snapshotsByUser,
    leaderboard,
    portfolioTotal,
    clockLabel,
    dailyQuest,
    register,
    submitOrder,
    advance,
    refresh,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame outside GameProvider');
  return ctx;
}

export { uidFromName };
