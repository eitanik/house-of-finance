import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import type { LeaderboardCache } from '../game/weekMetrics';
import type { Order, Player, PortfolioSnapshot } from '../game/types';
import { getDb } from '../firebase/config';
import {
  apiAdvanceWorld,
  apiRegisterPlayer,
  apiSubmitOrder,
  useCloudApi,
} from './cloudApi';

const worldRef = () => doc(getDb(), 'world', 'state');

export async function initWorldIfNeeded(): Promise<void> {
  if (useCloudApi()) return;
  const { initialWorldState } = await import('../game/engine');
  const { setDoc, getDoc: gd } = await import('firebase/firestore');
  const ref = worldRef();
  const snap = await gd(ref);
  if (snap.exists()) return;
  await setDoc(ref, initialWorldState());
}

export async function upsertPlayer(uid: string, displayName: string): Promise<Player> {
  if (useCloudApi()) {
    return apiRegisterPlayer(displayName);
  }
  const { initialWorldState } = await import('../game/engine');
  const { STARTING_CASH_ILS } = await import('../game/types');
  const { touchPlayerDaily } = await import('./dailyQuestPlayer');
  const { setDoc, getDoc, updateDoc } = await import('firebase/firestore');

  const ref = doc(getDb(), 'players', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const existing = touchPlayerDaily(snap.data() as Player);
    await updateDoc(ref, { dailyQuest: existing.dailyQuest });
    return existing;
  }
  const world = (await getDoc(worldRef())).data() ?? initialWorldState();
  let player: Player = {
    uid,
    displayName,
    cashIls: STARTING_CASH_ILS,
    holdings: {},
    createdAt: Date.now(),
  };
  player = touchPlayerDaily(player);
  await setDoc(ref, player);
  await setDoc(doc(getDb(), 'players', uid, 'snapshots', String((world as { simMs: number }).simMs)), {
    simMs: (world as { simMs: number }).simMs,
    totalIls: STARTING_CASH_ILS,
  });
  return player;
}

function firestoreUserMessage(e: unknown): string {
  const code = e && typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: string }).code) : '';
  const errText =
    e && typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string'
      ? (e as { message: string }).message
      : String(e);
  if (code === 'unavailable' || /\boffline\b/i.test(errText)) {
    return 'אין חיבור ל־Firestore (offline / רשת חסומה). בדקו אינטרנט, השביתו VPN/חוסם, רעננו. אם עודכנו Firestore Rules — הריצו: firebase deploy --only firestore:rules';
  }
  if (code === 'permission-denied') {
    return 'אין הרשאה לכתוב/לקרוא ב־Firestore. במצב ללא Functions חייבים לפרוס את firestore.rules המעודכנים: firebase deploy --only firestore:rules';
  }
  if (code === 'failed-precondition') {
    return 'אינדקס Firestore חסר — לחצו על הקישור בקונסול או הריצו firebase deploy --only firestore:indexes';
  }
  return errText;
}

function onSnapErr(ctx: string, err: unknown, onRuleError?: (msg: string) => void): void {
  console.error(`[Firestore] ${ctx}:`, err);
  const msg = firestoreUserMessage(err);
  onRuleError?.(msg);
}

export function subscribeWorld(
  cb: (w: import('../game/types').WorldState) => void,
  onError?: (msg: string) => void,
): Unsubscribe {
  return onSnapshot(
    worldRef(),
    (s) => {
      if (s.exists()) cb(s.data() as import('../game/types').WorldState);
    },
    (err) => onSnapErr('world/state', err, onError),
  );
}

export function subscribePlayer(uid: string, cb: (p: Player | null) => void, onError?: (msg: string) => void): Unsubscribe {
  return onSnapshot(
    doc(getDb(), 'players', uid),
    (s) => {
      cb(s.exists() ? (s.data() as Player) : null);
    },
    (err) => onSnapErr(`players/${uid}`, err, onError),
  );
}

export function subscribeLeaderboard(cb: (cache: LeaderboardCache | null) => void, onError?: (msg: string) => void): Unsubscribe {
  return onSnapshot(
    doc(getDb(), 'cache', 'leaderboard'),
    (s) => {
      cb(s.exists() ? (s.data() as LeaderboardCache) : null);
    },
    (err) => onSnapErr('cache/leaderboard', err, onError),
  );
}

/** @deprecated Prod uses cache/leaderboard — kept for legacy client-only mode */
export function subscribeAllPlayers(cb: (players: Player[]) => void, onError?: (msg: string) => void): Unsubscribe {
  return onSnapshot(
    collection(getDb(), 'players'),
    (snap) => {
      cb(snap.docs.map((d) => d.data() as Player));
    },
    (err) => onSnapErr('players', err, onError),
  );
}

export function subscribeOrdersForUser(uid: string, cb: (orders: Order[]) => void, onError?: (msg: string) => void): Unsubscribe {
  const q = query(
    collection(getDb(), 'orders'),
    where('userId', '==', uid),
    orderBy('submittedAtSimMs', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
    },
    (err) => onSnapErr(`orders user=${uid}`, err, onError),
  );
}

export async function fetchSnapshots(uid: string): Promise<PortfolioSnapshot[]> {
  const snap = await getDocs(collection(getDb(), 'players', uid, 'snapshots'));
  return snap.docs.map((d) => d.data() as PortfolioSnapshot).sort((a, b) => a.simMs - b.simMs);
}

export async function fetchPlayerByUid(uid: string): Promise<Player | null> {
  const snap = await getDoc(doc(getDb(), 'players', uid));
  return snap.exists() ? (snap.data() as Player) : null;
}

export async function submitOrderFs(
  uid: string,
  symbol: string,
  side: 'buy' | 'sell',
  amountIls: number,
): Promise<{ ok: boolean; error?: string }> {
  if (useCloudApi()) {
    return apiSubmitOrder(symbol, side, amountIls);
  }
  try {
    const { validateNewOrder } = await import('../game/orders');
    const { getWorldSeries } = await import('../game/worldGen');
    const { onPlayerOrder } = await import('./dailyQuestPlayer');
    const { setDoc, getDoc, updateDoc, serverTimestamp, collection: col } = await import('firebase/firestore');

    await initWorldIfNeeded();
    const worldSnap = await getDoc(worldRef());
    const world = worldSnap.data() as import('../game/types').WorldState;
    const playerSnap = await getDoc(doc(getDb(), 'players', uid));
    const player = playerSnap.data() as Player;
    const series = getWorldSeries(world.seed, world.epochDate);
    const err = validateNewOrder(side, amountIls, symbol, player, series, world.simMs);
    if (err) return { ok: false, error: err };

    const orderRef = doc(col(getDb(), 'orders'));
    await setDoc(orderRef, {
      userId: uid,
      symbol,
      side,
      amountIls,
      submittedAtSimMs: world.simMs,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    const updated = onPlayerOrder(player, symbol, side, amountIls);
    await updateDoc(doc(getDb(), 'players', uid), { dailyQuest: updated.dailyQuest });
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: firestoreUserMessage(e) };
  }
}

export async function advanceWorldFs(minutes: number): Promise<{ ok: boolean; error?: string }> {
  if (useCloudApi()) {
    return apiAdvanceWorld(minutes);
  }
  try {
    const { advanceSimMinutes, initialWorldState, snapshotPlayers } = await import('../game/engine');
    const { onPlayerAdvance } = await import('./dailyQuestPlayer');
    const { refreshHoldingsQuest } = await import('../game/dailyQuest');
    const { getDocs, updateDoc, setDoc, collection: col } = await import('firebase/firestore');

    const wSnap = await getDoc(worldRef());
    const world = (wSnap.data() ?? initialWorldState()) as import('../game/types').WorldState;

    const playersSnap = await getDocs(col(getDb(), 'players'));
    const players: Record<string, Player> = {};
    playersSnap.forEach((d) => {
      players[d.id] = d.data() as Player;
    });

    const ordersSnap = await getDocs(col(getDb(), 'orders'));
    const orders: Order[] = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));

    const result = advanceSimMinutes(world, players, orders, minutes);
    await updateDoc(worldRef(), { simMs: result.world.simMs });

    await Promise.all(
      Object.entries(result.players).map(([id, p]) => {
        let withDaily = onPlayerAdvance(p, minutes);
        withDaily = {
          ...withDaily,
          dailyQuest: refreshHoldingsQuest(withDaily.dailyQuest!, withDaily.holdings),
        };
        return updateDoc(doc(getDb(), 'players', id), {
          cashIls: withDaily.cashIls,
          holdings: withDaily.holdings,
          dailyQuest: withDaily.dailyQuest,
        });
      }),
    );

    await Promise.all(
      result.orders
        .filter((o) => o.status !== 'pending')
        .map((o) =>
          updateDoc(doc(getDb(), 'orders', o.id), {
            status: o.status,
            rejectReason: o.rejectReason ?? null,
            filledAtSimMs: o.filledAtSimMs ?? null,
            fillPriceNative: o.fillPriceNative ?? null,
            fillFx: o.fillFx ?? null,
            fillQty: o.fillQty ?? null,
            fillAmountIls: o.fillAmountIls ?? null,
          }),
        ),
    );

    const snaps = snapshotPlayers(result.world, result.players, result.world.simMs);
    await Promise.all(
      snaps.map(({ uid, snapshot }) =>
        setDoc(doc(getDb(), 'players', uid, 'snapshots', String(snapshot.simMs)), snapshot),
      ),
    );
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: firestoreUserMessage(e) };
  }
}
